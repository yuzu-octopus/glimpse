# Whole-page 1Hz decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a single 1Hz widget from re-streaming and rebuilding every widget on the page; poll live widgets alone through a dedicated endpoint and merge their frames without disturbing stable widget-list references.

**Architecture:** The whole-page `/api/page/:slug?stream` poll returns to `LIVE_POLL_MS` (30s) on every page. A new `GET /api/live/:slug` NDJSON endpoint reuses `fetchWidget` (so the existing 60s live cache prevents upstream hammering) and emits `StreamChunk`s only for types in `LIVE_TYPES`. A client ticker at `LIVE_TICK_MS` (1s) merges those frames through the existing `applyChunk` copy-on-write helper. `applyChunk` replaces only the array that owns the changed widget; it never clones regions that did not change, which is what keeps `widgetKeysCache` (a `WeakMap` keyed on widget arrays) and the memoized widget slots stable. `applyChunk`, `reconcileList`, `reconcileStreamEnd` and `setCache` are not modified by this plan.

**Tech Stack:** Bun 1.4.4 / `Bun.serve`, NDJSON streaming, React 19 hooks, Vitest with fake timers and `@testing-library/react`.

**Spec:** `/tmp/mobile-findings.md` — finding M08 and "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- `LIVE_POLL_MS` (30s) is the whole-page cadence on *every* page; the 1s cadence exists only in the per-widget endpoint path.
- Every task ends with a checkable test/command; implementers do **not** run formatters or repo-wide gates — the orchestrator runs them once per wave.
- One atomic commit per completed plan; commit message names the plan file. No push.
- Wave gates (orchestrator only): `bun check`; `biome lint <each edited TS/TSX file>`; `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`.
- Per-task test commands: `bun run test src/server/api.test.ts`; `bun run test src/client/hooks/usePageData.test.tsx`.

## Invariant: no region-ref replacement (explicit, must not be violated)

A live merge is a *path-scoped copy-on-write*, never a payload rebuild. After merging a frame for path `columns[ci].widgets[wi]`, all of the following hold against the previously emitted `PagePayload`:

- `next.headWidgets === previous.headWidgets` when no live frame targeted `headWidgets`.
- `next.widgets === previous.widgets` when no live frame targeted the flat `widgets` list.
- For every column `i ≠ ci`: `next.columns[i] === previous.columns[i]` **and** `next.columns[i].widgets === previous.columns[i].widgets`.
- Inside the owning column: `next.columns[ci].widgets !== previous.columns[ci].widgets` (fresh `slice()` from `applyChunk`) but every untouched widget object, including `next.columns[ci].widgets[wi+1]`, keeps its exact object identity.
- Every previously emitted snapshot is unmutated; the live path never writes `pageCache` and never calls `setCache`.
- Forbidden in the merge path: `structuredClone`, `{ ...previous, columns: previous.columns.map(...) }`, rebuilding `headWidgets`/`widgets` arrays, and replacing any widget object that has no live frame. `next = { ...previous }` (a top-level shallow clone) is the only clone allowed.
- Why: `widgetKeysCache` in `PageView.tsx` is a `WeakMap<WidgetLike[], string[]>` keyed on these very arrays. Replacing a non-owning array silently drops its cached keys and re-renders memoized `WidgetSlot`/`MobileColumn`/`ColumnGrid` trees — the exact churn this plan removes.

## Review Focus

- **Mixed lab page (one `server-stats`, one `rss`):** after a live tick, the static widget's array and object refs are unchanged. Pinned by Task 2 step 1.
- **Whole-page cadence:** 5 seconds of ticks produce zero `/api/page/` requests even when a homelab widget is present; 30 seconds produce exactly one. Pinned by Task 2 step 1.
- **Hidden tab:** neither interval fetches while `document.hidden`; the existing `visibilitychange` handler remains the revalidation path. Pinned by Task 2 step 2 (composes the M07 guard).
- **Upstream cost:** two 1s calls to the live endpoint fetch a given live widget once because `fetchWidget` uses the shared 60s TTL cache. Pinned by Task 1 step 1.
- **Stream-end reconciliation:** after live frames land, a page stream that ends with an unanswered widget still stamps `NO_RESPONSE_ERROR`, and live data survives the reconciliation. Pinned by Task 2 step 3.
- **Live endpoint failure:** a 500 or aborted live fetch leaves the rendered payload and stale notice untouched. Pinned by Task 2 step 4.

---

### Task 1: Live-only server endpoint

**Files:**
- Modify: `src/shared/live.ts` (add the tick constant)
- Modify: `src/server/api.ts` (add `streamLiveFrames` and a shared header-override helper)
- Modify: `src/server/index.ts` (add the route beside the existing `/api/page/` handler)
- Test: `src/server/api.test.ts`

**Interfaces:**
- Consumes: `fetchWidget`, `createFetchGate`, `isRecord`, `StreamChunk` from `src/server/api.ts`; `LIVE_TYPES` from `src/shared/live.ts`; `getConfig`, `ctx`, `json`, `checkRateLimit`, `server` from `src/server/index.ts`.
- Produces:
  - `LIVE_TICK_MS: 1000` from `src/shared/live.ts` (Task 2 imports it).
  - `streamLiveFrames(page: Page & { slug: string }, ctx: WidgetFetchContext): AsyncGenerator<StreamChunk>` from `src/server/api.ts`. It yields the same top-level `path` forms as `streamPagePayload` (`headWidgets[i]`, `columns[ci].widgets[wi]`, `widgets[i]`) but **only** for widget types present in `LIVE_TYPES`.
  - `GET /api/live/:slug` → NDJSON lines of `StreamChunk`, headers `content-type: application/x-ndjson` and `cache-control: no-store`; 404 JSON for an unknown slug; malformed percent-encoding returns the same 404 as the page route. Abort on `req.signal` so a disconnected client stops upstream work. No `?stream`/`?force` semantics, no rate-limit bucket.

- [ ] **Step 1: Write the failing server test**

Add to `src/server/api.test.ts` (it already imports `registerWidget`, `skeletonPagePayload`, `streamPagePayload`, `type StreamChunk`, `makeCtx`):

```ts
import { streamLiveFrames } from "./api";

describe("streamLiveFrames", () => {
	it("emits only live widgets and reuses the per-widget cache", async () => {
		const fetcher = vi.fn(async () => ({ cpu: 42 }));
		registerWidget("server-stats", fetcher);
		registerWidget("rss", vi.fn(async () => ({ items: [] })));
		const livePage = {
			name: "Lab",
			slug: "lab",
			columns: [{
				size: "full",
				widgets: [
					{ type: "server-stats" },
					{ type: "rss", cache: "1h" },
				],
			}],
		} as Parameters<typeof streamLiveFrames>[0];
		const ctx = makeCtx();

		const first: StreamChunk[] = [];
		for await (const c of streamLiveFrames(livePage, ctx)) first.push(c);
		const second: StreamChunk[] = [];
		for await (const c of streamLiveFrames(livePage, ctx)) second.push(c);

		expect(first).toHaveLength(1);
		expect(first[0].path).toBe("columns[0].widgets[0]");
		expect(first[0].payload.type).toBe("server-stats");
		expect(second).toHaveLength(1);
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/server/api.test.ts`
Expected: FAIL — `streamLiveFrames` is not exported.

- [ ] **Step 3: Add `LIVE_TICK_MS`**

In `src/shared/live.ts`, beside `LIVE_POLL_MS`:

```ts
/** Dedicated per-widget live frame cadence; the whole page polls at LIVE_POLL_MS. */
export const LIVE_TICK_MS = 1_000;
```

- [ ] **Step 4: Implement `streamLiveFrames`**

In `src/server/api.ts`:

1. Extract the `hideHeaders` config override currently duplicated inside `streamPagePayload`'s `push()` into a small local helper `applyHideHeaders(payload: WidgetPayload, hideHeaders: boolean): void`, and call it from both `streamPagePayload` and the new generator so a live frame cannot drop the page's `hide-header` setting.
2. Implement `streamLiveFrames(page, ctx)` by mirroring `streamPagePayload`'s top-level path walk (head, flat, or columns), but add the widget to `pending` **only** when `LIVE_TYPES[w.type]` is truthy. Each task calls `fetchWidget(ctx, page.slug, cachePath, widget, gate)`, applies `applyHideHeaders`, and returns `{ path, payload } satisfies StreamChunk`. Use the same resolved-queue drain as `streamPagePayload` so results stream as they settle. If no live widget exists, return without yielding.

Do not change `buildPagePayload`, `skeletonPagePayload` or `streamPagePayload`'s chunk shapes.

- [ ] **Step 5: Add the HTTP route**

In `src/server/index.ts`, add a live-slug handler before the `pageMatch` block:

```ts
const liveMatch = /^\/api\/live\/([^/]+)$/.exec(pathname);
if (liveMatch) {
	const r = getConfig();
	if (!r.ok) return json({ ok: false, errors: r.errors }, 400);
	let slug: string;
	try {
		slug = decodeURIComponent(liveMatch[1]);
	} catch {
		return json({ error: `page "${liveMatch[1]}" not found` }, 404);
	}
	const page = r.config?.pages.find((p) => p.slug === slug);
	if (!page) return json({ error: `page "${slug}" not found` }, 404);
	const abortController = new AbortController();
	req.signal.addEventListener("abort", () => abortController.abort(), { once: true });
	const enc = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const chunk of streamLiveFrames(page, ctx)) {
					controller.enqueue(enc.encode(`${JSON.stringify(chunk)}\n`));
				}
				controller.close();
			} catch (e) {
				controller.error(e);
			}
		},
		cancel() {
			abortController.abort();
		},
	});
	return new Response(stream, {
		headers: {
			"content-type": "application/x-ndjson",
			"cache-control": "no-store",
		},
	});
}
```

Note: `streamLiveFrames(page, ctx)` uses the shared `ctx`, so the per-widget TTL cache is intentionally shared with full page streams.

- [ ] **Step 6: Run the server tests**

Run: `bun run test src/server/api.test.ts`
Expected: PASS, including the pre-existing `buildPagePayload` and `streamPagePayload` tests.

### Task 2: Split the client poll and merge without region churn

**Files:**
- Modify: `src/client/hooks/usePageData.ts` (interval effect at lines 626-635, `doFetch`'s local `emit` at lines 513-535, new live ticker)
- Test: `src/client/hooks/usePageData.test.tsx`

**Interfaces:**
- Consumes: `LIVE_POLL_MS`, `LIVE_TICK_MS` from `src/shared/live.ts`; the `GET /api/live/:slug` NDJSON contract from Task 1; existing `applyChunk`, `dataRef`, `emit` dedupe fields (`preloadedRef`, `lastVersionRef`, `lastPayloadJsonRef`), `getLiveKey`, `__clearCacheForTests`.
- Produces: no new module exports. The hook's `data` now also reflects per-widget live frames; `validate`/`reload` still fetch the whole page.

- [ ] **Step 1: Write the failing cadence and ref-identity tests**

Add to `src/client/hooks/usePageData.test.tsx` (reuse `makePayload`, `ndjsonResponse`, `renderHook`, `act`, `waitFor`, the `seenProbe`/`SnapshotProbe` pattern and the `beforeEach`/`afterEach` setup). The page carries one live and one static widget:

```tsx
const liveWidget = {
	type: "server-stats" as WidgetType,
	config: { type: "server-stats" },
	data: { servers: [] },
};
const staticWidget = {
	type: "rss" as WidgetType,
	config: { type: "rss", title: "News" },
	data: { items: [] },
};
const mixed = (data: unknown) => makePayload({
	columns: [{ size: "full", widgets: [liveWidget, staticWidget] }],
});
```

Test A — whole-page polling stays 30s and live frames use the dedicated endpoint:

```tsx
it("polls the whole page at 30s and live widgets at 1s", async () => {
	const pageMock = vi.fn(async () => ndjsonResponse([
		{ path: "$skeleton", payload: mixed(null) },
		{ path: "columns[0].widgets[0]", payload: liveWidget },
		{ path: "columns[0].widgets[1]", payload: staticWidget },
	]));
	const liveMock = vi.fn(async () => ndjsonResponse([{
		path: "columns[0].widgets[0]",
		payload: { ...liveWidget, data: { servers: [{ name: "nas" }] } },
	}]));
	vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) =>
		String(input).startsWith("/api/live/") ? liveMock() : pageMock(),
	));
	vi.useFakeTimers();
	renderHook(() => usePageData("home"));
	vi.useRealTimers();
	await waitFor(() => expect(pageMock).toHaveBeenCalledTimes(1));

	vi.useFakeTimers();
	await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
	expect(pageMock).toHaveBeenCalledTimes(1);
	expect(liveMock.mock.calls.length).toBeGreaterThanOrEqual(4);
	await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
	expect(pageMock).toHaveBeenCalledTimes(2);
	vi.useRealTimers();
});
```

Test B — the invariant (capture emissions with the `SnapshotProbe` pattern; drive a live response with a fresh `data` value):

```tsx
it("merges a live frame without replacing untouched region arrays or widget objects", async () => {
	// Arrange fetch mocks so the page skeleton lands first, then one live frame.
	// Use the same gatedNdjson helper already in this file for the live response.
	seenProbe.length = 0;
	render(<SnapshotProbe />);
	await waitFor(() => expect(seenProbe.length).toBeGreaterThan(0));
	const before = seenProbe.at(-1)!;
	// push the live frame for columns[0].widgets[0] and wait for a new emission
	const after = seenProbe.at(-1)!;

	expect(after).not.toBe(before);
	expect(after.headWidgets).toBe(before.headWidgets);
	expect(after.widgets).toBe(before.widgets);
	expect(after.columns[1]).toBe(before.columns[1]);
	expect(after.columns[1].widgets).toBe(before.columns[1].widgets);
	expect(after.columns[0]).not.toBe(before.columns[0]);
	expect(after.columns[0].widgets).not.toBe(before.columns[0].widgets);
	expect(after.columns[0].widgets[1]).toBe(before.columns[0].widgets[1]);
	expect(after.columns[0].widgets[0].data).toEqual({ servers: [{ name: "nas" }] });
});
```

The assertions above are the executable form of the "no region-ref replacement" invariant in this plan's Global section; do not weaken them to `toEqual`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: FAIL — either `pageMock` was called ~30 times in 30s, or no `/api/live/` request occurred, or ref identities changed.

- [ ] **Step 3: Pin hidden-tab and failure behaviour**

Add two assertions to Test A: with `document.hidden` stubbed `true`, advance 5s and assert both mock call counts are unchanged; set `hidden` false, dispatch `visibilitychange`, and assert the return path revalidates. For the failure case, make `liveMock` return `new Response(null, { status: 500 })` once and assert `seenProbe.at(-1)` keeps its data and `view.result.current.error` stays `null`.

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: FAIL (still no live ticker).

- [ ] **Step 4: Pin stream-end reconciliation after a live merge**

Add a test using the file's existing `gatedNdjson()` helper: push a skeleton with two widgets, push a chunk for `columns[0].widgets[0]`, push a live frame for the same path, then close the stream. Import `NO_RESPONSE_ERROR` from `./usePageData` and assert:

```tsx
expect(final.columns[0].widgets[0].data).toEqual({ servers: [{ name: "nas" }] });
expect(final.columns[0].widgets[1].error).toBe(NO_RESPONSE_ERROR);
```

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: FAIL until the merge path exists and is isolated from `base`.

- [ ] **Step 5: Extract the shared emit callback**

In `src/client/hooks/usePageData.ts`, lift the body of the local `emit` inside `doFetch` (lines 514-532) into `const emitProgress = useCallback((progress: PagePayload, version: number): boolean => { ... }, [slug]);` at hook scope, using the same refs and the same `JSON.stringify` dedupe. Replace `onProgress`/final `emit(...)` calls in `doFetch` with `emitProgress(...)`. Preserve the `scheduleWidgetPreload` call on first emission and every `setData`/`setError` side effect exactly.

- [ ] **Step 6: Set the whole-page cadence and add the live ticker**

1. Change the interval effect (lines 628-635) to use `LIVE_POLL_MS` unconditionally and keep the M07 guard:

```ts
useEffect(() => {
	if (liveKey === "none") return;
	const id = window.setInterval(() => {
		if (document.hidden) return;
		void validate();
	}, LIVE_POLL_MS);
	return () => window.clearInterval(id);
}, [liveKey, validate]);
```

2. Add `const liveVersionRef = useRef(0);` beside the other refs.
3. Add a second effect below it that runs only when `liveKey !== "none"`. It creates one `AbortController`, a `busy` boolean guard (skip a tick if the previous fetch is still in flight), and a 1s `window.setInterval` calling an async `tick`. `tick` must: return early when `document.hidden || busy`; `fetch(\`/api/live/${encodeURIComponent(slug)}\`, { signal: ac.signal })`; return on `!res.ok || !res.body`; read the NDJSON body line by line; for each parsed `{ path, payload }` with a path, set `next ??= { ...dataRef.current! }` (the only clone) and call `applyChunk(next, path, payload)`; after the body ends, call `emitProgress(next, ++liveVersionRef.current)` if `next` exists. Wrap the body in `try/catch/finally`: a failed live tick clears nothing, raises no stale notice, and always resets `busy`; the effect cleanup clears the interval and aborts the controller. Never call `setCache` from this path.

Do not edit `applyChunk`, `reconcileList`, `reconcileStreamEnd`, `getLiveKey` or `runPageStream`.

- [ ] **Step 7: Run all client tests**

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: PASS — the new cadence, invariant, hidden-tab, failure and stream-end tests plus the existing render-skip/stream-reconciliation tests.


