import type { Page } from '../shared/config';
import { buildPagePayload } from './api';
import { getConfig } from './config';
import type { WidgetFetchContext } from './widgets/registry';

/** Max concurrent page builds during warmup — unbounded fan-out spikes
 * upstream connections and RSS on large configs. */
export const WARMUP_CONCURRENCY = 6;

/** Warm every page through the normal cache path (singleflight dedupes,
 * TTL fills) so first visitor never eats cold upstream latency.
 * Deletes stale prefix entries before re-fetch so a config edit never
 * serves stale TTL data. Concurrency-capped; one page failing never
 * rejects the batch (all-settled). */
export async function warmCache(ctx: WidgetFetchContext): Promise<void> {
  const r = getConfig();
  if (!r.ok || !r.config) return;
  const pages = r.config.pages;
  if (!pages || pages.length === 0) return;
  for (const p of pages) ctx.cache.deleteByPrefix(`${p.slug}:`);
  console.log(`[glimpse] warmup: ${pages.length} page(s), concurrency ${WARMUP_CONCURRENCY}`);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(WARMUP_CONCURRENCY, pages.length) },
    async () => {
      while (next < pages.length) {
        const page = pages[next++];
        // eslint-disable-next-line react-doctor/async-await-in-loop -- worker-pool fan-in: 6 workers share one cursor, sequential await per worker IS the concurrency cap
        await buildPagePayload(page as Page & { slug: string }, ctx).catch(() => {});
      }
    },
  );
  await Promise.allSettled(workers);
}
