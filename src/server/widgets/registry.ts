import type { WidgetType } from '../../shared/config';
import { Singleflight, TtlCache } from '../cache';

/** Everything a widget fetcher may need. `fetch` is injected so tests pass
 * canned payloads and no widget ever touches the network in a test. */
export interface WidgetFetchContext {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  cache: TtlCache;
  singleflight: Singleflight;
}

export type WidgetFetcher = (
  ctx: WidgetFetchContext,
  config: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Server-side fetcher registry, one entry per widget that pulls external
 * data. Config-only widgets (clock, bookmarks, search, todo, iframe, html,
 * calendar, group, split-column) are simply absent — the page builder yields
 * null data for them. Registered by each widget's server module.
 */
export const serverWidgets = new Map<WidgetType, WidgetFetcher>();

export function registerWidget(
  type: WidgetType,
  fetcher: WidgetFetcher,
): void {
  serverWidgets.set(type, fetcher);
}
