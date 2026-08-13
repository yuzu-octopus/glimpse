import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './monitor';
import type { MonitorSite } from '../../shared/widgets/payloads';

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>): {
  ctx: WidgetFetchContext;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn(fetchImpl);
  return {
    ctx: {
      fetch: fetchMock as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    },
    fetchMock,
  };
}

const monitorFetcher = () => serverWidgets.get('monitor')!;

describe('monitor fetcher', () => {
  it('reports ok with status and latency', async () => {
    const { ctx } = makeCtx(async () => new Response('ok', { status: 200 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', title: 'Example' }],
    })) as { sites: MonitorSite[] };
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0]).toMatchObject({
      ok: true,
      status: 200,
      title: 'Example',
      errorUrl: null,
      sameTab: false,
    });
    expect(data.sites[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('honors expected-status-code and falls back to url for title', async () => {
    const { ctx } = makeCtx(async () => new Response('gone', { status: 404 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com/missing', 'expected-status-code': 404 }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0].ok).toBe(true);
    expect(data.sites[0].title).toBe('https://example.com/missing');
  });

  it('marks mismatched status as failing', async () => {
    const { ctx } = makeCtx(async () => new Response('err', { status: 500 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com' }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0].ok).toBe(false);
    expect(data.sites[0].status).toBe(500);
  });

  it('keeps other sites on network error and nulls the failed one', async () => {
    const { ctx } = makeCtx(async (url) => {
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
      errorUrl: null,
      sameTab: false,
    });
    expect(data.sites[1].ok).toBe(true);
  });

  it('show-failing-only filters successes', async () => {
    const { ctx } = makeCtx(async (url) =>
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

  it('fetches check-url while keeping url as the link', async () => {
    const { ctx, fetchMock } = makeCtx(async () => new Response('ok', { status: 200 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', title: 'S', 'check-url': 'https://status.example.com/health' }],
    })) as { sites: MonitorSite[] };
    expect(fetchMock).toHaveBeenCalledWith('https://status.example.com/health', expect.anything());
    expect(data.sites[0].url).toBe('https://example.com');
  });

  it('treats alt-status-codes as ok alongside 200', async () => {
    const { ctx } = makeCtx(async () => new Response('blocked', { status: 403 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', 'alt-status-codes': [403] }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0].ok).toBe(true);
  });

  it('sends basic-auth credentials', async () => {
    const { ctx, fetchMock } = makeCtx(async () => new Response('ok', { status: 200 }));
    await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', 'basic-auth': { username: 'alice', password: 's3cret' } }],
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: `Basic ${btoa('alice:s3cret')}` },
    });
  });

  it('passes error-url and same-tab through', async () => {
    const { ctx } = makeCtx(async () => new Response('err', { status: 500 }));
    const data = (await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com', 'error-url': 'https://status.example.com', 'same-tab': true }],
    })) as { sites: MonitorSite[] };
    expect(data.sites[0]).toMatchObject({ ok: false, errorUrl: 'https://status.example.com', sameTab: true });
  });

  it('refuses http check-urls without allow-insecure', async () => {
    const { ctx } = makeCtx(async () => new Response('ok', { status: 200 }));
    await expect(
      monitorFetcher()(ctx, {
        type: 'monitor',
        sites: [{ url: 'http://example.com' }],
      }),
    ).rejects.toThrow(/allow-insecure/);

    const allowed = await monitorFetcher()(ctx, {
      type: 'monitor',
      sites: [{ url: 'http://example.com', 'allow-insecure': true }],
    });
    expect((allowed as { sites: MonitorSite[] }).sites[0].ok).toBe(true);
  });
});
