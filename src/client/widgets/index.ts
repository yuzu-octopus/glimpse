import { clientWidgets } from './registry';
import type { WidgetType } from '../../shared/config';

type Loader = () => Promise<unknown>;

// Shared loader for iframe/html (same chunk)
const iframeLoader: Loader = () => import('./iframe');

export const widgetLoaders: Record<string, Loader> = {
  'ai-quota': () => import('./ai-quota'),
  'contribution-graph': () => import('./contribution-graph'),
  bookmarks: () => import('./bookmarks'),
  'dns-stats': () => import('./dns'),
  'docker-containers': () => import('./docker'),
  'events-calendar': () => import('./events-calendar'),
  calendar: () => import('./calendar'),
  clock: () => import('./clock'),
  'custom-api': () => import('./custom-api'),
  'hacker-news': () => import('./hacker-news'),
  iframe: iframeLoader,
  html: iframeLoader,
  lobsters: () => import('./lobsters'),
  markets: () => import('./markets'),
  monitor: () => import('./monitor'),
  reddit: () => import('./reddit'),
  releases: () => import('./releases'),
  repository: () => import('./repository'),
  rss: () => import('./rss'),
  search: () => import('./search'),
  'server-stats': () => import('./server-stats'),
  'system-stats': () => import('./system-stats'),
  notepad: () => import('./notepad'),
  timer: () => import('./timer'),
  todo: () => import('./todo'),
  videos: () => import('./videos'),
  weather: () => import('./weather'),
  'weather-radar': () => import('./weather-radar'),
  'github-trending': () => import('./github-trending'),
  network: () => import('./network'),
  'change-detection': () => import('./change-detection'),
  immich: () => import('./immich'),
  jellyfin: () => import('./jellyfin'),
  qbittorrent: () => import('./qbittorrent'),
  transmission: () => import('./transmission'),
  'twitch-channels': () => import('./twitch-channels'),
  'twitch-top-games': () => import('./twitch-top-games'),
};

const widgetPromises = new Map<string, Promise<unknown>>();

/** Resolve the loader promise for `type`, deduped. Returns null for containers or unknown types. */
export function ensureWidgetLoaded(type: string): Promise<unknown> | null {
  if (type === 'group' || type === 'split-column') return null;
  if (clientWidgets.has(type as WidgetType)) return null;
  const loader = widgetLoaders[type];
  if (!loader) return null;
  let p = widgetPromises.get(type);
  if (!p) {
    p = loader().catch(() => {});
    widgetPromises.set(type, p);
    // iframe/html share the same underlying import — warm the alias too
    if (type === 'iframe' && !widgetPromises.has('html')) widgetPromises.set('html', p);
    if (type === 'html' && !widgetPromises.has('iframe')) widgetPromises.set('iframe', p);
  }
  return p;
}

/** Eagerly import every widget chunk. Idempotent — second call reuses cached promises. */
export function preloadWidgets(): Promise<void> {
  const loaders = new Set<Loader>(Object.values(widgetLoaders));
  const promises = [...loaders].map((l) => {
    // Find a representative type for this loader to reuse ensureWidgetLoaded dedupe
    const entry = Object.entries(widgetLoaders).find(([, v]) => v === l);
    const t = entry?.[0] ?? '';
    const existing = t ? widgetPromises.get(t) : undefined;
    if (existing) return existing;
    const p = l().catch(() => {});
    if (t) {
      widgetPromises.set(t, p);
      if (t === 'iframe') widgetPromises.set('html', p);
      if (t === 'html') widgetPromises.set('iframe', p);
    }
    return p;
  });
  return Promise.all(promises).then(() => {});
}

/** Test helper — same as preloadWidgets. Exposed for suites that need synchronous registration. */
export function __preloadWidgetsForTests(): Promise<void> {
  return preloadWidgets();
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
  if (typeof g.requestIdleCallback === 'function') {
    g.requestIdleCallback(kick, { timeout: 2000 });
  } else {
    setTimeout(kick, 1000);
  }
}
