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
 * Two call shapes are accepted so existing `fetchWidget` and the
 * 4-arg spec `fetchWidgetData(type, config, ctx, fetcher)` both type-check:
 *  - fetchWidgetData(ctx, type, config, cacheKey, fetcher)
 *  - fetchWidgetData(type, config, ctx, fetcher)   // key derived as `${type}:${JSON.stringify(config)}` (tests)
 */

export const WIDGET_DEFAULT_LIMIT = 5;

export function widgetLimit(
  cfg: { limit?: number },
  fallback = WIDGET_DEFAULT_LIMIT,
): number {
  return cfg.limit ?? fallback;
}

// ponytail: limit TTL centralized — add per-widget overrides when needed, not now

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
  a: WidgetFetchContext | string,
  b: string | Record<string, unknown>,
  c: Record<string, unknown> | WidgetFetchContext,
  d: string | Fetcher<T>,
  e?: Fetcher<T>,
): Promise<T> {
  // Normalise the two supported signatures.
  let ctx: WidgetFetchContext;
  let type: string;
  let config: Record<string, unknown>;
  let cacheKey: string;
  let fetcher: Fetcher<T>;

  if (typeof a === 'string') {
    // spec shape: (type, config, ctx, fetcher[, cacheKey?])
    type = a;
    config = b as Record<string, unknown>;
    ctx = c as WidgetFetchContext;
    if (typeof d === 'string' && e) {
      cacheKey = d;
      fetcher = e;
    } else {
      fetcher = d as Fetcher<T>;
      cacheKey = `${type}:${JSON.stringify(config)}`;
    }
  } else {
    // preferred shape: (ctx, type, config, cacheKey, fetcher)
    ctx = a;
    type = b as string;
    config = c as Record<string, unknown>;
    if (typeof d === 'string') {
      cacheKey = d;
      fetcher = e as Fetcher<T>;
    } else {
      // (ctx, type, config, fetcher) — no explicit key
      fetcher = d as Fetcher<T>;
      cacheKey = `${type}:${JSON.stringify(config)}`;
    }
  }

  if (!fetcher) throw new Error('fetchWidgetData: missing fetcher');
  if (!isWidgetCtx(ctx)) throw new Error('fetchWidgetData: invalid ctx');

  const ttlMs =
    typeof (config as Record<string, unknown>).cache === 'string'
      ? parseCacheDuration((config as Record<string, unknown>).cache as string)
      : getDefaultTtl(type);

  const cached = ctx.cache.get<T>(cacheKey);
  if (cached !== undefined) return cached;

  const data = await ctx.singleflight.run(cacheKey, () => fetcher(ctx, config));
  ctx.cache.set(cacheKey, data, ttlMs);
  return data;
}

/** Helper for per-feed sub-fetches: cache-first + singleflight + negative cache (30s). */
export async function cachedFetch<T>(
  ctx: WidgetFetchContext,
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const cached = ctx.cache.get<T>(key);
  if (cached !== undefined) return cached;
  const neg = ctx.cache.getError(key);
  if (neg !== undefined) throw neg;
  try {
    const data = await ctx.singleflight.run(key, fetcher);
    if (ttlMs !== undefined) ctx.cache.set(key, data, ttlMs);
    return data;
  } catch (err) {
    ctx.cache.setError(key, err, 30_000);
    throw err;
  }
}

