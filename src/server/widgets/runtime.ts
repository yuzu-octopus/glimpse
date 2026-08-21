import { getDefaultTtl, parseCacheDuration } from '../cache';
import type { WidgetFetchContext } from './registry';

/**
 * Deep WidgetData module — small interface, deep behaviour.
 *
 * Owns per-widget caching concerns so `src/server/api.ts` and every
 * widget fetcher stay thin:
 * - cacheKey is the `slug:path` string built by fetchWidget (passed in).
 * - ttl comes from the widget's `cache` string or getDefaultTtl(type).
 * - singleflight dedupes concurrent identical fetches.
 * - limit ownership: callers pass raw widget config; the fetcher
 *   they supply should be pure parse+fetch (zod defaults already give
 *   limit=5 where the schema declares it). A tiny helper `widgetLimit`
 *   is exported for legacy callers that still do `cfg.limit ?? 5`.
 *
 * Why not stash cacheKey building here? Page-level keys are `slug:path`
 * built in fetchWidget; putting the template there keeps runtime
 * generic for both page widgets and per-feed sub-keys (videos).
 * For page widgets the key *is* owned — the caller forwards the same
 * `${pageSlug}:${path}` it would have built inline.
 *
 * Single call shape: fetchWidgetData(ctx, type, config, cacheKey, fetcher) —
 * the key is the `${pageSlug}:${path}` string built by fetchWidget.
 */
export const WIDGET_DEFAULT_LIMIT = 5;

export function widgetLimit(
  cfg: { limit?: number },
  fallback = WIDGET_DEFAULT_LIMIT,
): number {
  return cfg.limit ?? fallback;
}


type Fetcher<T = unknown> = (
  ctx: WidgetFetchContext,
  config: Record<string, unknown>,
) => Promise<T>;

function isWidgetCtx(v: unknown): v is WidgetFetchContext {
  return (
    typeof v === 'object' &&
    v !== null &&
    'cache' in v &&
    'singleflight' in v &&
    'fetch' in v
  );
}

export async function fetchWidgetData<T = unknown>(
  ctx: WidgetFetchContext,
  type: string,
  config: Record<string, unknown>,
  cacheKey: string,
  fetcher: Fetcher<T>,
): Promise<T> {
  if (!isWidgetCtx(ctx)) throw new Error('fetchWidgetData: invalid ctx');

  const ttlMs =
    typeof config.cache === 'string'
      ? parseCacheDuration(config.cache)
      : getDefaultTtl(type);

  const cached = ctx.cache.get<T>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await ctx.singleflight.run(cacheKey, () => fetcher(ctx, config));
  ctx.cache.set(cacheKey, data, ttlMs);
  return data;
}


