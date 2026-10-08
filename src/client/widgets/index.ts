import type { WidgetType } from "../../shared/config";
import { clientWidgets } from "./registry";

type Loader = () => Promise<unknown>;

// Shared loader for iframe/html (same chunk)
const iframeLoader: Loader = () => import("./iframe");

export const widgetLoaders: Record<string, Loader> = {
	"ai-quota": () => import("./ai-quota"),
	"contribution-graph": () => import("./contribution-graph"),
	bookmarks: () => import("./bookmarks"),
	"dns-stats": () => import("./dns"),
	"docker-containers": () => import("./docker"),
	"events-calendar": () => import("./events-calendar"),
	calendar: () => import("./calendar"),
	clock: () => import("./clock"),
	"custom-api": () => import("./custom-api"),
	"hacker-news": () => import("./hacker-news"),
	iframe: iframeLoader,
	html: iframeLoader,
	lobsters: () => import("./lobsters"),
	markets: () => import("./markets"),
	monitor: () => import("./monitor"),
	reddit: () => import("./reddit"),
	releases: () => import("./releases"),
	repository: () => import("./repository"),
	rss: () => import("./rss"),
	search: () => import("./search"),
	"server-stats": () => import("./server-stats"),
	"system-stats": () => import("./system-stats"),
	notepad: () => import("./notepad"),
	timer: () => import("./timer"),
	todo: () => import("./todo"),
	videos: () => import("./videos"),
	weather: () => import("./weather"),
	"weather-radar": () => import("./weather-radar"),
	"github-trending": () => import("./github-trending"),
	network: () => import("./network"),
	"change-detection": () => import("./change-detection"),
	immich: () => import("./immich"),
	jellyfin: () => import("./jellyfin"),
	qbittorrent: () => import("./qbittorrent"),
	transmission: () => import("./transmission"),
	"twitch-channels": () => import("./twitch-channels"),
	"twitch-top-games": () => import("./twitch-top-games"),
	"home-assistant": () => import("./home-assistant"),
	"model-endpoints": () => import("./model-endpoints"),
	tailscale: () => import("./tailscale"),
	"model-releases": () => import("./model-releases"),
	speedtest: () => import("./speedtest"),
};

const widgetPromises = new Map<string, Promise<unknown>>();

/** Resolve the loader promise for `type`, deduped. Returns null for containers or unknown types. */
export function ensureWidgetLoaded(type: string): Promise<unknown> | null {
	if (type === "group" || type === "split-column") return null;
	if (clientWidgets.has(type as WidgetType)) return null;
	const loader = widgetLoaders[type];
	if (!loader) return null;
	let p = widgetPromises.get(type);
	if (!p) {
		const loaded = loader();
		// Callers suspend on this promise and fire-and-forget others; it resolves
		// to undefined on failure rather than rejecting into a Suspense boundary.
		p = loaded.catch(() => {});
		widgetPromises.set(type, p);
		// A chunk that failed once (a stale service-worker chunk name after a
		// deploy, a storage-pressure eviction) must not be memoized for the
		// session: a swallowed rejection resolves to undefined, so the entry
		// would hand every later caller the same "loaded" answer and strand the
		// widget on its Suspense skeleton even after the network came back.
		loaded.catch(() => {
			if (widgetPromises.get(type) === p) widgetPromises.delete(type);
			if (type === "iframe" && widgetPromises.get("html") === p) widgetPromises.delete("html");
			if (type === "html" && widgetPromises.get("iframe") === p) widgetPromises.delete("iframe");
		});
		// iframe/html share the same underlying import — warm the alias too
		if (type === "iframe" && !widgetPromises.has("html")) widgetPromises.set("html", p);
		if (type === "html" && !widgetPromises.has("iframe")) widgetPromises.set("iframe", p);
	}
	return p;
}

/** Idle-preload one page's widget chunks (deduped via ensureWidgetLoaded).
 * Scoped to the visible page — no global preload-all, so off-page chunks
 * stay code-split and load on demand. No-op for empty/unknown types. */
export function scheduleWidgetPreload(types: string[] = []): void {
	if (types.length === 0) return;
	const kick = () => {
		for (const t of types) void ensureWidgetLoaded(t);
	};
	const g = globalThis as unknown as {
		requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
	};
	if (typeof g.requestIdleCallback === "function") {
		g.requestIdleCallback(kick, { timeout: 2000 });
	} else {
		setTimeout(kick, 1000);
	}
}
