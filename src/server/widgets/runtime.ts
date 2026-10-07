import { getDefaultTtl, parseCacheDuration } from "../cache";
import type { WidgetFetchContext } from "./registry";

/**
 * Deep WidgetData module — small interface, deep behaviour.
 *
 * Owns per-widget caching concerns so `src/server/api.ts` and every
 * widget fetcher stay thin:
 * - cacheKey is the `slug:path` string built by fetchWidget (passed in).
 * - ttl comes from the widget's `cache` string or getDefaultTtl(type).
 * - singleflight dedupes concurrent identical fetches.
 * - limit ownership: callers pass raw widget config; the fetcher owns
 *   limit, because the zod schema it parses is the only place a default
 *   is declared, so nothing downstream may re-default it.
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

type Fetcher<T = unknown> = (
	ctx: WidgetFetchContext,
	config: Record<string, unknown>,
) => Promise<T>;

export async function fetchWidgetData<T = unknown>(
	ctx: WidgetFetchContext,
	type: string,
	config: Record<string, unknown>,
	cacheKey: string,
	fetcher: Fetcher<T>,
): Promise<T> {
	const ttlMs =
		typeof config.cache === "string" ? parseCacheDuration(config.cache) : getDefaultTtl(type);

	const cached = ctx.cache.get<T>(cacheKey);
	if (cached !== undefined) return cached;

	let data: T;
	try {
		data = await ctx.singleflight.run(cacheKey, () => fetcher(ctx, config));
	} catch (err) {
		// Stale-on-error: prefer last good value over propagating the failure.
		const stale = ctx.cache.getStale<T>(cacheKey);
		if (stale !== undefined) return stale;
		throw err;
	}
	ctx.cache.set(cacheKey, data, ttlMs);
	return data;
}
