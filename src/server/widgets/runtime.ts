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
/** How long a hard upstream failure is remembered: a flapping widget polled
 * every second retries at most ~12/min instead of every poll. Deliberately
 * shorter than every positive TTL including the 1s homelab tier, so recovery
 * is never masked for long. `?force` clears the slug prefix (deleteByPrefix),
 * which drops negative entries too — an explicit reload always re-fetches.
 *
 * Only connection-level and 5xx-class failures land here (the shapes
 * `fetchWithRetry` throws after exhausting its budget — `HTTP 5xx …`,
 * `HTTP fetch failed …`, fetch's `TypeError: fetch failed`). A 4xx, a
 * config-shaped error, or any other message is caller error or a test
 * double, not a flapping upstream: caching it would turn a fixable
 * misconfiguration into a silent 5s blackout. */
export const NEGATIVE_TTL_MS = 5_000;

const NEGATIVEABLE =
	/^(?:HTTP (?:5\d\d|fetch failed)|.*\b(?:ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|connection refused)\b)/;

function isNegativeable(err: unknown): boolean {
	const message = err instanceof Error ? err.message : String(err);
	return NEGATIVEABLE.test(message);
}

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
	const negative = ctx.cache.get<unknown>(`${cacheKey}:negative`);
	if (negative !== undefined) {
		if (negative instanceof Error) throw negative;
		throw new Error(typeof negative === "string" ? negative : "upstream unavailable");
	}

	let data: T;
	try {
		data = await ctx.singleflight.run(cacheKey, () => fetcher(ctx, config));
	} catch (err) {
		// Stale-on-error: prefer last good value over propagating the failure.
		const stale = ctx.cache.getStale<T>(cacheKey);
		if (stale !== undefined) return stale;
		// No last good value: remember hard upstream failures briefly so a
		// flapping widget isn't retried on every 1s poll. Stored under the
		// same `slug:path` key family so `?force` (deleteByPrefix) clears it
		// too. Caller-shaped errors (4xx, validation) skip the cache — the
		// next poll must see them again, not a 5s-old copy.
		if (isNegativeable(err)) ctx.cache.set(`${cacheKey}:negative`, err, NEGATIVE_TTL_MS);
		throw err;
	}
	ctx.cache.set(cacheKey, data, ttlMs);
	return data;
}
