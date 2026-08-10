import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './monitor';
import type { MonitorSite } from './monitor';

function makeCtx(fetchImpl: (url: string) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const monitorFetcher = () => serverWidgets.get('monitor')!;

describe('monitor fetcher', () => {
  it('reports ok with status and latency', async () => {
    const ctx = makeCtx(async () => new Response('ok', { status: 200 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', title: 'Example' }],
    })) as { sites: MonitorSite[] };
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0].ok).toBe(true);
    expect(data.sites[0].status).toBe(200);
    expect(data.sites[0].title).toBe('Example');
    expect(data.sites[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('honors expected-status-code and falls back to url for title', async () => {
    const ctx = makeCtx(async () => new Response('gone', { status: 404 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com/missing', 'expected-status-code': 404 }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0].ok).toBe(true);
    expect(data.sites[0].title).toBe('https://example.com/missing');
  });

  it('marks mismatched status as failing', async () => {
    const ctx = makeCtx(async () => new Response('err', { status: 500 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com' }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0].ok).toBe(false);
    expect(data.sites[0].status).toBe(500);
  });

  it('keeps other sites on network error and nulls the failed one', async () => {
    const ctx = makeCtx(async (url) => {
      if (url.includes('down')) throw new Error('connection refused');
      return new Response('ok', { status: 200 });
    });
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com/down' }, { url: 'https://example.com/up' }],
    })) as { sites: MonitorSite[] };
    expect(data.sites).toHaveLength(2);
    expect(data.sites[0]).toEqual({
      url: 'https://example.com/down',
      title: 'https://example.com/down',
      ok: false,
      status: null,
      ms: null,
    });
    expect(data.sites[1].ok).toBe(true);
  });

  it('show-failing-only filters successes', async () => {
    const ctx = makeCtx(async (url) =>
      url.includes('down') ? new Response('err', { status: 500 }) : new Response('ok', { status: 200 }),
    );
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com/down' }, { url: 'https://example.com/up' }],
      'show-failing-only': true,
    })) as { sites: MonitorSite[] };
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0].url).toBe('https://example.com/down');
  });
});
