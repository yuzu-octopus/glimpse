import type { Page } from '../shared/config';
import { buildPagePayload } from './api';
import { getConfig } from './config';
import type { WidgetFetchContext } from './widgets/registry';

/** Warm every page through the normal cache path (singleflight dedupes,
 * TTL fills) so first visitor never eats cold upstream latency. */
export async function warmCache(ctx: WidgetFetchContext): Promise<void> {
  const r = getConfig();
  if (!r.ok || !r.config) return;
  const pages = r.config.pages;
  if (!pages || pages.length === 0) return;
  await Promise.allSettled(
    pages.map((page) => buildPagePayload(page as Page & { slug: string }, ctx)),
  );
}
