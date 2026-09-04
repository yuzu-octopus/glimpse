import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import { monitorSchema } from '../../shared/widgets/keyed';
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

const kumaPage = {
  config: { slug: 'homelab', title: 'Homelab' },
  publicGroupList: [
    {
      id: 1,
      name: 'Services',
      monitorList: [
        { id: 1, name: 'Grafana', sendUrl: 'https://grafana.lab' },
        { id: 2, name: 'Dead box', sendUrl: 'https://dead.lab' },
      ],
    },
  ],
  heartbeatList: {
    '1': [{ status: 1, time: '2026-09-04T00:00:00Z', msg: 'OK', ping: 42 }],
    '2': [{ status: 0, time: '2026-09-04T00:00:00Z', msg: 'connect ECONNREFUSED', ping: null }],
  },
};

const hcList = {
  checks: [
    { name: 'Nightly backup', slug: 'nightly-backup', status: 'up' },
    { name: 'Cron sync', slug: 'cron-sync', status: 'down' },
    { name: 'Heartbeat', slug: 'heartbeat', status: 'grace' },
  ],
};

function sourceCtx(opts?: { kumaDown?: boolean; hcDown?: boolean }) {
  return makeCtx(async (url) => {
    if (url.includes('/api/status-page/')) {
      if (opts?.kumaDown) throw new Error('kuma unreachable');
      return Response.json(kumaPage);
    }
    if (url.includes('/api/v3/checks/')) {
      if (opts?.hcDown) return new Response('unauthorized', { status: 401 });
      return Response.json(hcList);
    }
    return new Response('ok', { status: 200 });
  });
}

async function fetchSites(ctx: WidgetFetchContext, config: Record<string, unknown>): Promise<MonitorSite[]> {
  const data: unknown = await monitorFetcher()(ctx, config);
  if (data && typeof data === 'object' && 'sites' in data && Array.isArray(data.sites)) {
    const sites = data.sites as MonitorSite[]; // fetcher contract: { sites: MonitorSite[] }
    return sites;
  }
  throw new Error('monitor fetcher returned no sites array');
}

describe('monitor external sources', () => {
  it('maps kuma status-page monitors to site rows', async () => {
    const { ctx, fetchMock } = sourceCtx();
    const sites = await fetchSites(ctx, {
      type: 'monitor',
      'kuma-url': 'https://kuma.lab',
      'kuma-slug': 'homelab',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://kuma.lab/api/status-page/homelab',
      expect.anything(),
    );
    expect(sites).toEqual([
      {
        url: 'https://grafana.lab',
        title: 'Grafana',
        ok: true,
        status: 200,
        ms: 42,
        errorUrl: null,
        sameTab: false,
      },
      {
        url: 'https://dead.lab',
        title: 'Dead box',
        ok: false,
        status: null,
        ms: null,
        errorUrl: null,
        sameTab: false,
      },
    ]);
  });

  it('maps healthchecks list-checks to site rows and sends the api key', async () => {
    const { ctx, fetchMock } = sourceCtx();
    const sites = await fetchSites(ctx, {
      type: 'monitor',
      'healthchecks-key': 'read-key',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://healthchecks.io/api/v3/checks/',
      expect.objectContaining({ headers: { 'X-Api-Key': 'read-key' } }),
    );
    expect(sites).toEqual([
      { url: 'https://healthchecks.io', title: 'Nightly backup', ok: true, status: null, ms: null, errorUrl: null, sameTab: false },
      { url: 'https://healthchecks.io', title: 'Cron sync', ok: false, status: null, ms: null, errorUrl: null, sameTab: false },
      { url: 'https://healthchecks.io', title: 'Heartbeat', ok: true, status: null, ms: null, errorUrl: null, sameTab: false },
    ]);
  });

  it('passes healthchecks tag filters as query params', async () => {
    const { ctx, fetchMock } = sourceCtx();
    await monitorFetcher()(ctx, {
      type: 'monitor',
      'healthchecks-key': 'read-key',
      'healthchecks-tags': ['prod', 'db'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://healthchecks.io/api/v3/checks/?tag=prod&tag=db',
      expect.anything(),
    );
  });

  it('merges direct sites with both sources and filters failing-only across them', async () => {
    const { ctx } = sourceCtx();
    const sites = await fetchSites(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com/up' }],
      'kuma-url': 'https://kuma.lab',
      'kuma-slug': 'homelab',
      'healthchecks-key': 'read-key',
      'show-failing-only': true,
    });
    expect(sites.map((s) => s.title).sort()).toEqual(['Cron sync', 'Dead box']);
  });

  it('degrades a dead source to no rows while direct checks still report', async () => {
    const { ctx } = sourceCtx({ kumaDown: true, hcDown: true });
    const sites = await fetchSites(ctx, {
      type: 'monitor',
      sites: [{ url: 'https://example.com' }],
      'kuma-url': 'https://kuma.lab',
      'kuma-slug': 'homelab',
      'healthchecks-key': 'bad-key',
    });
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ url: 'https://example.com', ok: true });
  });

  it('refuses http source urls without allow-insecure', async () => {
    const { ctx } = sourceCtx();
    await expect(
      monitorFetcher()(ctx, {
        type: 'monitor',
        'kuma-url': 'http://kuma.lab',
        'kuma-slug': 'homelab',
      }),
    ).rejects.toThrow(/allow-insecure/);
  });

  it('requires at least one source and pairs kuma fields', () => {
    expect(monitorSchema.safeParse({ type: 'monitor' }).success).toBe(false);
    expect(
      monitorSchema.safeParse({ type: 'monitor', 'kuma-url': 'https://kuma.lab' }).success,
    ).toBe(false);
    expect(
      monitorSchema.safeParse({
        type: 'monitor',
        'kuma-url': 'https://kuma.lab',
        'kuma-slug': 'homelab',
      }).success,
    ).toBe(true);
    expect(
      monitorSchema.safeParse({ type: 'monitor', 'healthchecks-key': 'k' }).success,
    ).toBe(true);
  });
});
