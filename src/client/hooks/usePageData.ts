import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
	useTransition,
} from "react";
import type { PagePayload, WidgetPayload } from "../../shared/api";
import { LIVE_POLL_MS, LIVE_TYPES } from "../../shared/live";
import { CONFIG_ONLY } from "../../shared/widgets";
import { scheduleWidgetPreload } from "../widgets";

export type PageDataResult = {
	data: PagePayload | null;
	error: string | null;
	isValidating: boolean;
	validate: () => Promise<void>;
	reload: (force?: boolean) => Promise<void>;
};

/** Every widget type rendered by a payload (head, columns, flat, nested containers). */
function collectWidgetTypes(payload: PagePayload): string[] {
	const out = new Set<string>();
	const check = (widgets: WidgetPayload[]): void => {
		for (const w of widgets) {
			if (w.widgets) check(w.widgets);
			if (w.type !== "group" && w.type !== "split-column") out.add(w.type);
		}
	};
	if (payload.headWidgets) check(payload.headWidgets);
	for (const col of payload.columns) check(col.widgets);
	if (payload.widgets) check(payload.widgets);
	return [...out];
}

function getLiveKey(payload: PagePayload): "none" | "live" | "homelab" {
	let hasLive = false;
	let hasHomelab = false;
	const check = (widgets: WidgetPayload[]): void => {
		for (const w of widgets) {
			const type = w.type;
			if (w.widgets) {
				check(w.widgets);
				if (type === "group" || type === "split-column") continue;
			}
			if (type === "server-stats" || type === "system-stats") hasHomelab = true;
			else if (LIVE_TYPES[type]) hasLive = true;
		}
	};
	if (payload.headWidgets) check(payload.headWidgets);
	for (const col of payload.columns) check(col.widgets);
	if (payload.widgets) check(payload.widgets);
	if (hasHomelab) return "homelab";
	if (hasLive) return "live";
	return "none";
}

const pageCache = new Map<string, { data: PagePayload; fetchedAt: number }>();
const GC_MS = 5 * 60_000;
const STALE_MS = 30_000;

/**
 * A failure that happened while a payload was already on screen. The page is
 * still readable, so this is not a page error — it is the dashboard telling
 * the user it has stopped being true. Module-level because it outlives any
 * one page: the notice belongs to the shell, which is mounted once, while the
 * fetch that produced it belongs to whichever page is open.
 */
export type StaleNotice = { reason: string; at: number };

let staleNotice: StaleNotice | null = null;
const staleListeners = new Set<() => void>();

function setStaleNotice(next: StaleNotice | null): void {
	if (staleNotice === next) return;
	staleNotice = next;
	for (const l of staleListeners) l();
}

function subscribeStaleNotice(cb: () => void): () => void {
	staleListeners.add(cb);
	return () => {
		staleListeners.delete(cb);
	};
}

const readStaleNotice = (): StaleNotice | null => staleNotice;

/** The last refresh that failed over a rendered payload, or null when the
 * dashboard is current. The shell renders this as a non-blocking notice. */
export function useStaleNotice(): StaleNotice | null {
	return useSyncExternalStore(subscribeStaleNotice, readStaleNotice, readStaleNotice);
}

/** The GC handle for one slug's cache entry. */
type GcTimer = ReturnType<typeof setTimeout>;

/**
 * One pending GC per slug, replaced on every write. A discarded handle per
 * setCache is ~300 live timers per slug on the 1s homelab poll, all of which
 * fire at the same moment to do nothing.
 */
const gcTimers = new Map<string, GcTimer>();

function setCache(slug: string, data: PagePayload) {
	pageCache.set(slug, { data, fetchedAt: Date.now() });
	clearTimeout(gcTimers.get(slug));
	gcTimers.set(
		slug,
		setTimeout(() => {
			gcTimers.delete(slug);
			const entry = pageCache.get(slug);
			if (entry && Date.now() - entry.fetchedAt > GC_MS) pageCache.delete(slug);
		}, GC_MS + 1000),
	);
}

function getCached(slug: string): PagePayload | null {
	const entry = pageCache.get(slug);
	if (!entry) return null;
	return entry.data;
}

function isStale(slug: string): boolean {
	const entry = pageCache.get(slug);
	if (!entry) return true;
	return Date.now() - entry.fetchedAt > STALE_MS;
}

function applyChunk(base: PagePayload, path: string, payload: unknown): void {
	const w = payload as WidgetPayload;
	let m = /^columns\[(\d+)\]\.widgets\[(\d+)\]$/.exec(path);
	if (m) {
		const col = base.columns[Number(m[1])];
		if (col?.widgets[Number(m[2])]) col.widgets[Number(m[2])] = w;
		return;
	}
	m = /^headWidgets\[(\d+)\]$/.exec(path);
	if (m) {
		if (base.headWidgets[Number(m[1])]) base.headWidgets[Number(m[1])] = w;
		return;
	}
	m = /^widgets\[(\d+)\]$/.exec(path);
	if (m && base.widgets) {
		const idx = Number(m[1]);
		if (base.widgets[idx]) {
			base.widgets = base.widgets.slice();
			base.widgets[idx] = w;
		}
	}
}

function reconcileWithCached(skeleton: PagePayload, cached: PagePayload): PagePayload {
	const base: PagePayload = skeleton;
	if (base.headWidgets && cached.headWidgets) {
		for (let i = 0; i < base.headWidgets.length; i++) {
			if (cached.headWidgets[i]) base.headWidgets[i] = cached.headWidgets[i];
		}
	}
	for (let ci = 0; ci < base.columns.length; ci++) {
		const sCol = base.columns[ci];
		const cCol = cached.columns[ci];
		if (!cCol) continue;
		for (let wi = 0; wi < sCol.widgets.length; wi++) {
			if (cCol.widgets[wi]) sCol.widgets[wi] = cCol.widgets[wi];
		}
	}
	if (base.widgets && cached.widgets) {
		for (let i = 0; i < base.widgets.length; i++) {
			if (cached.widgets[i]) base.widgets[i] = cached.widgets[i];
		}
	}
	return base;
}

/**
 * Reason stamped on a widget the stream never answered. Deliberately claims
 * nothing about the upstream — only that it never spoke.
 */
export const NO_RESPONSE_ERROR =
	"No response received — the update stream closed before this widget reported.";

/**
 * Copy-on-write reconciliation of one widget list: a new list when something
 * changed, `undefined` when it was already honest. Copy-on-write (never
 * mutation) because `applyChunk` only ever swaps whole widget objects and the
 * memo'd slots key off object *and* array identity.
 */
function reconcileList(list: WidgetPayload[] | undefined): WidgetPayload[] | undefined {
	if (!list) return undefined;
	let next: WidgetPayload[] | undefined;
	for (let i = 0; i < list.length; i++) {
		const w = list[i];
		// Containers are config-only, but their children stream inside the
		// container's own frame: a dropped group frame strands every child.
		const kids = reconcileList(w.widgets);
		// Left exactly as they are: a config-only type is `data: null` by design,
		// and a widget carrying data or an error was answered (or failed) already.
		const unanswered = CONFIG_ONLY[w.type] !== true && w.data == null && w.error == null;
		if (!kids && !unanswered) continue;
		next ??= list.slice();
		const replacement: WidgetPayload = { ...w };
		if (kids) replacement.widgets = kids;
		if (unanswered) replacement.error = NO_RESPONSE_ERROR;
		next[i] = replacement;
	}
	return next;
}

/**
 * End-of-stream reconciliation.
 *
 * The stream closing IS the boundary: once the reader is done no further frame
 * can arrive, so a widget still at `data: null` with no error is a truncated
 * stream rather than a slow one. A slow widget that answers *before* the close
 * keeps its data untouched, and a page where every widget answered returns
 * unchanged — no copy, no re-render, no cache difference.
 *
 * Only the streaming paths call this. A plain JSON body is a whole page in one
 * verified HTTP response; there is nothing there to be truncated.
 */
function reconcileStreamEnd(
	base: PagePayload,
	signal: AbortSignal,
	onProgress?: (p: PagePayload, version: number) => void,
	versionRef?: { current: number },
): void {
	// An abort means the caller walked away. The partial payload is what today's
	// code already caches in that case, and stamping "no response" on it would
	// poison the next load of this slug.
	if (signal.aborted) return;
	let changed = false;
	const head = reconcileList(base.headWidgets);
	if (head) {
		base.headWidgets = head;
		changed = true;
	}
	for (const col of base.columns) {
		const list = reconcileList(col.widgets);
		if (list) {
			col.widgets = list;
			changed = true;
		}
	}
	const flat = reconcileList(base.widgets);
	if (flat) {
		base.widgets = flat;
		changed = true;
	}
	if (changed) {
		if (versionRef) versionRef.current++;
		onProgress?.({ ...base }, versionRef?.current ?? 0);
	}
}

/** One caller of a shared in-flight fetch: its own signal, its own progress
 * callback. A subscriber's abort detaches it; it never ends the request. */
type Subscriber = {
	signal: AbortSignal;
	onProgress?: (p: PagePayload, version: number) => void;
};

/**
 * A shared request owns its OWN AbortController. The caller's signal is a
 * subscription, never a budget the request inherits — which is what keeps a
 * prefetch's 10s deadline from becoming the mounted page's deadline, and what
 * lets a joining page receive the progressive frames the prefetch discarded.
 */
type Inflight = {
	controller: AbortController;
	promise: Promise<PagePayload>;
	subs: Set<Subscriber>;
};

const inflight = new Map<string, Inflight>();
const versionBySlug = new Map<string, number>();

function attach(
	entry: Inflight,
	signal: AbortSignal,
	onProgress?: (p: PagePayload, version: number) => void,
): () => void {
	const sub: Subscriber = { signal, onProgress };
	entry.subs.add(sub);
	const detach = (): void => {
		if (!entry.subs.delete(sub)) return;
		// Nobody is left to read it: ending the request is then free, and is what
		// stops an abandoned page's stream from running to completion.
		if (entry.subs.size === 0) entry.controller.abort();
	};
	if (signal.aborted) detach();
	else signal.addEventListener("abort", detach, { once: true });
	return detach;
}

async function runPageStream(slug: string, entry: Inflight, force: boolean): Promise<PagePayload> {
	const { controller, subs } = entry;
	const signal = controller.signal;
	const versionRef = { current: 0 };
	const emit = (payload: PagePayload): void => {
		for (const sub of subs) {
			if (!sub.signal.aborted) sub.onProgress?.({ ...payload }, versionRef.current);
		}
	};
	const qs = force ? "?stream&force=1" : "?stream";
	const res = await fetch(`/api/page/${encodeURIComponent(slug)}${qs}`, { signal });
	if (!res.ok) {
		const rawBody: unknown = await res.json().catch(() => ({}));
		let msg = `HTTP ${res.status}`;
		if (rawBody !== null && typeof rawBody === "object" && "error" in rawBody) {
			const maybe = rawBody.error;
			if (typeof maybe === "string" && maybe) msg = maybe;
		}
		throw new Error(msg);
	}
	const ct = res.headers.get("content-type") ?? "";
	const isNdjson = ct.includes("ndjson");

	const cached = force ? null : getCached(slug);
	// Clone: applyChunk mutates `base` in place, and `base` is set to `cachedBase`.
	// Without the clone, the cached payload would be mutated, corrupting the cache.
	const cachedBase = cached ? structuredClone(cached) : null;
	let base: PagePayload | null = null;
	const skeletonOf = (chunk: { path?: string; payload?: unknown }): PagePayload | null => {
		if (chunk.path !== "$skeleton") return null;
		const candidate = chunk.payload;
		if (candidate === null || typeof candidate !== "object") return null;
		if (!("columns" in candidate)) return null;
		return candidate as PagePayload;
	};

	const handleLine = (line: string): void => {
		if (!line.trim() || signal.aborted) return;
		let chunk: { path?: string; payload?: unknown };
		try {
			chunk = JSON.parse(line);
		} catch {
			return;
		}
		const skeleton = skeletonOf(chunk);
		if (skeleton) {
			if (!base) {
				base = cachedBase ? reconcileWithCached(skeleton, cachedBase) : skeleton;
				emit({ ...base });
			}
			return;
		}
		if (!base) {
			if (!cachedBase) return;
			base = cachedBase;
			emit({ ...base });
		}
		if (!chunk.path || !base) return;
		applyChunk(base, chunk.path, chunk.payload);
		versionRef.current++;
		emit({ ...base });
	};

	if (!isNdjson) {
		const text = await res.text();
		try {
			const parsed: unknown = JSON.parse(text);
			if (parsed !== null && typeof parsed === "object" && "columns" in parsed) {
				const payload = parsed as PagePayload;
				setCache(slug, payload);
				emit(payload);
				return payload;
			}
		} catch {
			// fall through to line-split fallback
		}
		for (const line of text.split("\n")) handleLine(line);
		if (!base) throw new Error("empty stream");
		if (signal.aborted) return base;
		reconcileStreamEnd(base, signal, emit);
		setCache(slug, base);
		return base;
	}

	if (!res.body) throw new Error("empty stream");
	const reader = res.body.getReader();
	const dec = new TextDecoder();
	let buf = "";
	const onAbort = (): void => {
		reader.cancel().catch(() => {});
	};
	signal.addEventListener("abort", onAbort, { once: true });
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (signal.aborted) {
				await reader.cancel().catch(() => {});
				break;
			}
			buf += dec.decode(value, { stream: true });
			let nl = buf.indexOf("\n");
			while (nl >= 0) {
				handleLine(buf.slice(0, nl));
				buf = buf.slice(nl + 1);
				nl = buf.indexOf("\n");
			}
		}
		buf += dec.decode();
		handleLine(buf);
	} finally {
		signal.removeEventListener("abort", onAbort);
		if (signal.aborted) {
			try {
				await reader.cancel();
			} catch {}
		}
	}
	if (!base) throw new Error("empty stream");
	// A stream cut short is not a payload. reconcileStreamEnd already declines
	// to stamp it; the cache must decline to keep it too, or the next visit
	// inside STALE_MS reads widgets that never answered as permanent skeletons
	// with no error badge.
	if (signal.aborted) return base;
	reconcileStreamEnd(base, signal, emit, versionRef);
	versionBySlug.set(slug, versionRef.current);
	setCache(slug, base);
	return base;
}

/**
 * Join the in-flight request for `slug`, or start one. Concurrent callers for
 * the same page share a single request, but each keeps its own signal and its
 * own progress frames — sharing the response, never the budget.
 */
function fetchPage(
	slug: string,
	signal: AbortSignal,
	onProgress?: (p: PagePayload, version: number) => void,
	force = false,
): Promise<PagePayload> {
	// An entry whose last subscriber walked away has already been aborted; it is
	// a corpse, not a shared response, and joining it would hand the new caller
	// the previous caller's abort.
	const existing = force ? undefined : inflight.get(slug);
	if (existing && !existing.controller.signal.aborted) {
		attach(existing, signal, onProgress);
		return existing.promise;
	}
	const entry: Inflight = {
		controller: new AbortController(),
		subs: new Set(),
		promise: null as unknown as Promise<PagePayload>,
	};
	attach(entry, signal, onProgress);
	const pending = runPageStream(slug, entry, force);
	entry.promise = pending;
	inflight.set(slug, entry);
	return pending.finally(() => {
		if (inflight.get(slug) === entry) inflight.delete(slug);
	});
}

export function prefetchPage(slug: string) {
	if (!isStale(slug) && pageCache.has(slug)) return;
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), 10000);
	fetchPage(slug, ac.signal)
		.catch(() => {})
		.finally(() => clearTimeout(t));
}

export function usePageData(slug: string): PageDataResult {
	const [data, setData] = useState<PagePayload | null>(() => getCached(slug));
	const [error, setError] = useState<string | null>(null);
	const [isValidatingRaw, setIsValidatingRaw] = useState(() => isStale(slug));
	const [isPending, startTransition] = useTransition();
	const isValidating = isPending || isValidatingRaw;
	const dataRef = useRef<PagePayload | null>(data);
	const abortRef = useRef<AbortController | null>(null);
	const validatingCountRef = useRef(0);
	// Render-skip: last emitted version — polls that change nothing skip setData
	// so memo'd WidgetSlots don't re-render.
	const lastVersionRef = useRef<number | null>(null);
	// Cross-poll dedupe: the stream version counter resets to 0 on every fetch,
	// so identical payloads from different polls get different versions. The
	// content hash is the genuine identity check across streams.
	const lastPayloadJsonRef = useRef<string | null>(null);
	const preloadedRef = useRef<string | null>(null);

	useEffect(() => {
		dataRef.current = data;
	}, [data]);

	const doFetch = useCallback(
		async (signal: AbortSignal, force = false) => {
			if (signal.aborted) return;
			validatingCountRef.current += 1;
			setIsValidatingRaw(true);
			try {
				// Render-skip + visible-page preload. Returns true when emitted.
				const emit = (progress: PagePayload, version: number): boolean => {
					if (signal.aborted) return false;
					if (preloadedRef.current !== slug) {
						preloadedRef.current = slug;
						scheduleWidgetPreload(collectWidgetTypes(progress));
					}
					// Content is the dedupe identity: the stream version counter resets
					// to 0 on every fetch, so versions collide across polls (stream 2's
					// v1 === stream 1's v1) and a version-only check would swallow a
					// genuinely changed payload.
					const json = JSON.stringify(progress);
					if (json === lastPayloadJsonRef.current) return false;
					lastVersionRef.current = version;
					lastPayloadJsonRef.current = json;
					dataRef.current = progress;
					setData(progress);
					setError(null);
					return true;
				};
				const onProgress = (progress: PagePayload, version: number) => {
					emit(progress, version);
				};
				const next = await fetchPage(slug, signal, onProgress, force);
				if (signal.aborted) return;
				setStaleNotice(null);
				const version = versionBySlug.get(slug) ?? 0;
				startTransition(() => {
					emit(next, version);
				});
			} catch (e) {
				if ((e instanceof Error && e.name === "AbortError") || signal.aborted) return;
				const msg = e instanceof Error ? e.message : String(e);
				if (dataRef.current) {
					// A payload is already on screen, so this is not a failed page — it
					// is a dashboard that has stopped being true. Discarding the error
					// here is what let a dead network look exactly like a live one.
					startTransition(() => setStaleNotice({ reason: msg, at: Date.now() }));
				} else {
					startTransition(() => setError(msg));
				}
			} finally {
				validatingCountRef.current = Math.max(0, validatingCountRef.current - 1);
				if (validatingCountRef.current === 0) setIsValidatingRaw(false);
			}
		},
		[slug],
	);

	const reload = useCallback(
		async (force = false) => {
			if (force) {
				dataRef.current = null;
				lastVersionRef.current = null;
				setData(null);
				setError(null);
			}
			abortRef.current?.abort();
			const ac = new AbortController();
			abortRef.current = ac;
			await doFetch(ac.signal, force);
		},
		[doFetch],
	);

	const validate = useCallback(async () => {
		await reload(false);
	}, [reload]);

	useEffect(() => {
		const cached = getCached(slug);
		if (cached) {
			dataRef.current = cached;
			lastVersionRef.current = null;
			setData(cached);
			setError(null);
			setIsValidatingRaw(isStale(slug));
		} else {
			dataRef.current = null;
			lastVersionRef.current = null;
			setData(null);
			setError(null);
			setIsValidatingRaw(true);
		}
		abortRef.current?.abort();
		const ac = new AbortController();
		abortRef.current = ac;
		void doFetch(ac.signal, false);
		// Focus, tab-return, reconnect and service-worker takeover all mean the
		// same thing to a warm cache: something changed while the page was idle,
		// so revalidate instead of showing the last reading as current.
		const revalidate = () => {
			if (isStale(slug)) void validate();
		};
		const onVisible = () => {
			if (document.visibilityState === "visible") revalidate();
		};
		const onControllerChange = () => {
			void validate();
		};
		window.addEventListener("focus", revalidate);
		window.addEventListener("online", revalidate);
		document.addEventListener("visibilitychange", onVisible);
		navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
		return () => {
			ac.abort();
			window.removeEventListener("focus", revalidate);
			window.removeEventListener("online", revalidate);
			document.removeEventListener("visibilitychange", onVisible);
			navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
		};
	}, [slug, doFetch, validate]);

	const liveKey = data ? getLiveKey(data) : "none";

	useEffect(() => {
		if (liveKey === "none") return;
		const interval = liveKey === "homelab" ? 1000 : LIVE_POLL_MS;
		const id = window.setInterval(() => {
			void validate();
		}, interval);
		return () => window.clearInterval(id);
	}, [liveKey, validate]);

	return { data, error, isValidating, validate, reload };
}

export function __clearCacheForTests() {
	pageCache.clear();
	inflight.clear();
	versionBySlug.clear();
	for (const t of gcTimers.values()) clearTimeout(t);
	gcTimers.clear();
	staleListeners.clear();
	staleNotice = null;
}
