import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './hacker-news';
import './reddit';
import './videos';
import type { Video } from '../../shared/widgets/payloads';

function makeHnCtx(fetchImpl: (url: string) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

// 1. HN concurrency limit 6
describe('T4 TDD failing', () => {
  it('hn limits concurrency to 6 (pLimit)', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const fetchImpl = async (url: string) => {
      if (url.includes('topstories.json')) {
        return new Response(JSON.stringify(ids), { status: 200 });
      }
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      // delay a tick
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      const m = url.match(/item\/(\d+)\.json/);
      const id = m ? Number(m[1]) : 0;
      return new Response(JSON.stringify({ id, title: `Post ${id}`, time: 1_700_000_000 }), { status: 200 });
    };
    const ctx = makeHnCtx(fetchImpl as unknown as (url: string) => Promise<Response>);
    const fetcher = serverWidgets.get('hacker-news')!;
    await fetcher(ctx, { type: 'hacker-news', limit: 20 });
    // After fix, maxConcurrent should be <=6
    expect(maxConcurrent).toBeLessThanOrEqual(6);
  });

  it('reddit token singleflight (concurrent fetches share one POST)', async () => {
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('access_token')) {
        tokenCalls++;
        // delay so concurrent calls overlap
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ access_token: 'tok123', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { children: [] } }), { status: 200 });
    });
    const ctx: WidgetFetchContext = {
      fetch: fetchMock as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    const fetcher = serverWidgets.get('reddit')!;
    const cfg = { type: 'reddit', subreddit: 'selfhosted', 'app-auth': { id: 'id', secret: 'sec' } } as unknown as Record<string, unknown>;
    await Promise.all([fetcher(ctx, cfg), fetcher(ctx, cfg), fetcher(ctx, cfg)]);
    expect(tokenCalls).toBe(1);
  });

  it('videos stale fallback after TTL expiry still returns last videos', async () => {
    vi.useFakeTimers();
    const FEED = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><title>C</title><entry><title>V1</title><link href="https://www.youtube.com/watch?v=aaa"/><published>2024-01-02T10:00:00+00:00</published></entry></feed>`;
    let shouldFail = false;
    const fetchImpl = async (_url: string) => {
      if (shouldFail) return new Response('', { status: 500 });
      return new Response(FEED, { status: 200 });
    };
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    const fetcher = serverWidgets.get('videos')!;
    const cfg = { type: 'videos', channels: ['UC1234567890123456789012'] } as unknown as Record<string, unknown>;
    const first = (await fetcher(ctx, cfg)) as { videos: Video[] };
    expect(first.videos[0].title).toBe('V1');
    // advance past STATIC_TTL_MS (3_600_000) + a bit
    shouldFail = true;
    vi.advanceTimersByTime(3_600_000 + 1000);
    const pending = fetcher(ctx, cfg) as Promise<{ videos: Video[] }>;
    await vi.advanceTimersByTimeAsync(4000);
    const second = await pending;
    expect(second.videos[0].title).toBe('V1');
    vi.useRealTimers();
  });

  it('cache getStale retains after TTL and negative cache setError', async () => {
    const c = new TtlCache();
    c.set('k', 'val', 100);
    // should be fres
    expect(c.get('k')).toBe('val');
    // @ts-ignore
    // advance time past TTL - we use real Date.now, so use vi fake
    vi.useFakeTimers();
    const c2 = new TtlCache();
    c2.set('k', 'val', 100);
    vi.advanceTimersByTime(150);
    // fresh miss but stale should still be there
    expect(c2.get('k')).toBeUndefined();
    expect((c2 as unknown as { getStale: (k:string)=>unknown }).getStale?.('k')).toBe('val');
    // negative cache
    (c2 as unknown as { setError: (k:string, e:unknown, ttl:number)=>void }).setError('err:k', new Error('fail'), 30_000);
    expect((c2 as unknown as { getError: (k:string)=>unknown }).getError('err:k')).toBeTruthy();
    vi.advanceTimersByTime(30_001);
    expect((c2 as unknown as { getError: (k:string)=>unknown }).getError('err:k')).toBeUndefined();
    vi.useRealTimers();
  });
});
