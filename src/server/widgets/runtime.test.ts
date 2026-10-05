import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

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

  it('uses the 1h static TTL when the widget has no cache string', async () => {
    // Asserting only that a value landed in the cache proves nothing about the
    // TTL. The default has to be pinned from BOTH sides — a TTL that is too
    // short is caught by crossing it, a TTL that is too long only by checking
    // the entry is still there one tick short of it.
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const fetcher = vi.fn(async () => ({ ok: true }));
      await fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', fetcher);
      expect(ctx.cache.get('k')).toEqual({ ok: true });
      // rss is not in LIVE_TYPES, so the default is STATIC_TTL_MS.
      await vi.advanceTimersByTimeAsync(3_599_999);
      expect(ctx.cache.get('k')).toEqual({ ok: true });
      await vi.advanceTimersByTimeAsync(2);
      expect(ctx.cache.get('k')).toBeUndefined();
      await fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the 60s live TTL for a live widget type', async () => {
    // A live widget polling at the static 1h cadence would show data an hour
    // stale, which is the whole reason LIVE_TYPES carries a separate default.
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const fetcher = vi.fn(async () => ({ ok: true }));
      await fetchWidgetData(ctx, 'markets', { type: 'markets' }, 'k', fetcher);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(ctx.cache.get('k')).toEqual({ ok: true });
      await vi.advanceTimersByTimeAsync(2);
      expect(ctx.cache.get('k')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('an explicit cache string wins over the type default', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const fetcher = vi.fn(async () => ({ ok: true }));
      await fetchWidgetData(ctx, 'markets', { type: 'markets', cache: '2h' }, 'k', fetcher);
      await vi.advanceTimersByTimeAsync(7_200_000 - 1);
      expect(ctx.cache.get('k')).toEqual({ ok: true });
      await vi.advanceTimersByTimeAsync(2);
      expect(ctx.cache.get('k')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  // The one behaviour here that decides what a user sees when an upstream
  // dies: a last good value beats a red error banner, and only when there is
  // no last good value does the error through.
  it('serves the retained stale value when the fetcher throws', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const good = vi.fn(async () => ({ items: [{ title: 'good' }] }));
      await fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', good);
      // Fresh TTL expires, the stale copy is what is left.
      await vi.advanceTimersByTimeAsync(3_600_001);
      const bad = vi.fn(async () => {
        throw new Error('upstream 500');
      });
      const data = await fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', bad);
      expect(data).toEqual({ items: [{ title: 'good' }] });
      expect(bad).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates the error when there is no last good value', async () => {
    const ctx = makeCtx();
    const bad = vi.fn(async () => {
      throw new Error('upstream 500');
    });
    await expect(fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', bad)).rejects.toThrow('upstream 500');
    // A thrown fetch must not poison the key: the next poll has to try again.
    const good = vi.fn(async () => ({ items: [] }));
    await expect(fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', good)).resolves.toEqual({ items: [] });
    expect(good).toHaveBeenCalledOnce();
  });

  it('does not write a failed fetch into the cache', async () => {
    const ctx = makeCtx();
    const bad = vi.fn(async () => {
      throw new Error('upstream 500');
    });
    await expect(fetchWidgetData(ctx, 'rss', { type: 'rss' }, 'k', bad)).rejects.toThrow();
    expect(ctx.cache.get('k')).toBeUndefined();
    expect(ctx.cache.getStale('k')).toBeUndefined();
  });
});
