import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

// TDD red: fetchWidgetData should cache on second call.
// This import will fail until runtime.ts exists.
import { fetchWidgetData } from './runtime';

function makeCtx(): WidgetFetchContext {
  return {
    fetch: vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

describe('fetchWidgetData', () => {
  it('cache hit avoids second fetcher call', async () => {
    const ctx = makeCtx();
    const fetcher = vi.fn(async (_ctx: WidgetFetchContext, _cfg: Record<string, unknown>) => ({ items: [{ title: 'x' }] }));
    const widgetConfig = { type: 'rss', cache: '1h', limit: 5, feeds: [{ url: 'https://example.com/feed' }] };
    const cacheKey = 'home:f:0';
    const first = await fetchWidgetData(ctx, 'rss', widgetConfig, cacheKey, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ items: [{ title: 'x' }] });
    const second = await fetchWidgetData(ctx, 'rss', widgetConfig, cacheKey, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); // cached
    expect(second).toEqual(first);
  });

  it('singleflight dedupes concurrent fetches', async () => {
    const ctx = makeCtx();
    const { promise, resolve } = Promise.withResolvers<unknown>();
    const fetcher = vi.fn(() => promise as Promise<unknown>);
    const cfg = { type: 'rss', cache: '1h' };
    const key = 'home:f:1';
    const p1 = fetchWidgetData(ctx, 'rss', cfg, key, fetcher);
    const p2 = fetchWidgetData(ctx, 'rss', cfg, key, fetcher);
    resolve({ items: [] });
    const [a, b] = await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ items: [] });
    expect(b).toEqual({ items: [] });
  });

  it('uses default TTL when widget has no cache string', async () => {
    const ctx = makeCtx();
    const fetcher = vi.fn(async () => ({ ok: true }));
    // no cache field -> LIVE_TYPES check; rss is static => 1h
    await fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', fetcher);
    expect(ctx.cache.get('k')).toEqual({ ok: true });
  });
});
