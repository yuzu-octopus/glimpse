import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './dns';
import type { DnsStats } from '../../shared/widgets/payloads';

function makeCtx(routes: Record<string, unknown> | ((url: string, init?: RequestInit) => unknown)): WidgetFetchContext {
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const hit = typeof routes === 'function' ? (routes as (u: string, i?: RequestInit) => unknown)(url, init) : routes[url];
    if (hit === undefined) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    if (hit && typeof hit === 'object' && '__status' in (hit as Record<string, unknown>)) {
      const { __status, __body } = hit as { __status: number; __body: unknown };
      return new Response(JSON.stringify(__body), { status: __status });
    }
    return new Response(JSON.stringify(hit), { status: 200 });
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('dns-stats')!;

describe('dns-stats fetcher', () => {
  it('fetches AdGuard stats and maps totals, latency, series and top domains', async () => {
    const qs = Array.from({ length: 24 }, (_, i) => 100 + i * 10);
    const bs = Array.from({ length: 24 }, (_, i) => 10 + i);
    const ctx = makeCtx({
      'http://adguard.local/control/stats': {
        num_dns_queries: 5000,
        dns_queries: qs,
        num_blocked_filtering: 1000,
        blocked_filtering: bs,
        avg_processing_time: 0.012,
        top_blocked_domains: [{ 'ads.example': 400 }, { 'tracker.example': 300 }],
      },
    });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'adguard',
      url: 'http://adguard.local',
      username: 'admin',
      password: 'secret',
    })) as DnsStats;

    expect(data.totalQueries).toBe(5000);
    expect(data.blockedPercent).toBe(20);
    expect(data.responseTime).toBe(12);
    expect(data.series).toHaveLength(8);
    expect(data.series[7].percentTotal).toBe(100);
    expect(data.series[0].queries).toBeGreaterThan(0);
    expect(data.timeLabels).toHaveLength(8);
    expect(data.topBlockedDomains).toHaveLength(2);
    expect(data.topBlockedDomains[0].domain).toBe('ads.example');
    expect(data.topBlockedDomains[0].percentBlocked).toBe(40);
    expect(data.topBlockedDomains[1].percentBlocked).toBe(30);
  });

  it('fetches Pi-hole v6 with session and builds bars from 145-point history', async () => {
    const history = Array.from({ length: 145 }, (_, i) => ({ timestamp: 1_700_000_000 + i * 600, total: 10, blocked: 2 }));
    const routes: Record<string, unknown> = {
      'http://pihole.local/api/auth': { session: { sid: 'SID123' } },
      'http://pihole.local/api/stats/summary': {
        queries: { total: 2000, blocked: 500, percent_blocked: 25 },
        gravity: { domains_being_blocked: 120_000 },
      },
      'http://pihole.local/api/history': { history },
      'http://pihole.local/api/stats/top_domains?blocked=true': {
        domains: [
          { domain: 'ads.test', count: 200 },
          { domain: 'track.test', count: 100 },
        ],
      },
    };
    const ctx = makeCtx(routes);
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
      password: 'pw',
    })) as DnsStats;

    expect(data.totalQueries).toBe(2000);
    expect(data.blockedPercent).toBe(25);
    expect(data.domainsBlocked).toBe(120_000);
    expect(data.series).toHaveLength(8);
    expect(data.series[0].queries).toBe(180);
    expect(data.series[0].percentBlocked).toBe(20);
    expect(data.series[0].percentTotal).toBe(100);
    expect(data.topBlockedDomains[0]).toEqual({ domain: 'ads.test', percentBlocked: 40 });
    expect(data.topBlockedDomains[1]).toEqual({ domain: 'track.test', percentBlocked: 20 });
    const fetchMock = ctx.fetch as unknown as { mock: { calls: [string][] } };
    expect(fetchMock.mock.calls.some(([u]) => u.endsWith('/api/auth'))).toBe(true);
  });

  it('hides graph — Pi-hole v6 skips history fetch', async () => {
    const routes: Record<string, unknown> = {
      'http://pihole.local/api/auth': { session: { sid: 'SID123' } },
      'http://pihole.local/api/stats/summary': {
        queries: { total: 100, blocked: 10, percent_blocked: 10 },
        gravity: { domains_being_blocked: 1000 },
      },
      'http://pihole.local/api/stats/top_domains?blocked=true': { domains: [] },
    };
    const ctx = makeCtx(routes);
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
      password: 'pw',
      'hide-graph': true,
    })) as DnsStats;

    expect(data.series).toEqual([]);
    const calls = (ctx.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(([u]) => u as string);
    expect(calls.some((u) => u.includes('/api/history'))).toBe(false);
  });

  it('falls back to Pi-hole v5 when v6 auth fails and token is present', async () => {
    const qsMap: Record<string, number> = {};
    const bsMap: Record<string, number> = {};
    const base = 1_700_000_000;
    for (let i = 0; i < 144; i++) {
      const ts = String(base + i * 600);
      qsMap[ts] = 5;
      bsMap[ts] = 1;
    }
    const routes = (url: string) => {
      if (url.endsWith('/api/auth')) return { __status: 404, __body: { error: 'not found' } };
      if (url.includes('/admin/api.php')) {
        return {
          dns_queries_today: 800,
          ads_blocked_today: 160,
          ads_percentage_today: 20,
          domains_being_blocked: 50_000,
          domains_over_time: qsMap,
          ads_over_time: bsMap,
          top_ads: { 'ads.example': 80, 'other.example': 40 },
        };
      }
      return undefined;
    };
    const ctx = makeCtx(routes as unknown as Record<string, unknown>);
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
      password: 'pw',
      token: 'tok',
    })) as DnsStats;

    expect(data.totalQueries).toBe(800);
    expect(data.blockedPercent).toBe(20);
    expect(data.series).toHaveLength(8);
    expect(data.topBlockedDomains[0].domain).toBe('ads.example');
  });

  it('fetches Pi-hole v5 directly when no password', async () => {
    const qsMap: Record<string, number> = {};
    const bsMap: Record<string, number> = {};
    const base = 1_700_000_000;
    for (let i = 0; i < 144; i++) {
      const ts = String(base + i * 600);
      qsMap[ts] = 2;
      bsMap[ts] = 0;
    }
    const ctx = makeCtx({
      'http://pihole.local/admin/api.php?summaryRaw&topItems&overTimeData10mins&auth=tok': {
        dns_queries_today: 300,
        ads_blocked_today: 0,
        ads_percentage_today: 0,
        domains_being_blocked: 10_000,
        domains_over_time: qsMap,
        ads_over_time: bsMap,
        top_ads: [],
      },
    });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
      token: 'tok',
    })) as DnsStats;

    expect(data.totalQueries).toBe(300);
    expect(data.domainsBlocked).toBe(10_000);
    expect(data.topBlockedDomains).toEqual([]);
  });

  it('hides top domains when hide-top-domains is true', async () => {
    const ctx = makeCtx({
      'http://adguard.local/control/stats': {
        num_dns_queries: 100,
        dns_queries: Array(24).fill(1),
        num_blocked_filtering: 10,
        blocked_filtering: Array(24).fill(0),
        avg_processing_time: 0,
        top_blocked_domains: [{ 'x.example': 5 }],
      },
    });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'adguard',
      url: 'http://adguard.local',
      'hide-top-domains': true,
    })) as DnsStats;
    expect(data.topBlockedDomains).toEqual([]);
  });

  it('fers technitium stats', async () => {
    const ctx = makeCtx({
      'http://tech.local/api/dashboard/stats/get?token=tok&type=LastDay': {
        response: {
          stats: { totalQueries: 1000, blockedQueries: 250, blockedZones: 100, blockListZones: 200 },
          mainChartData: {
            datasets: [
              { label: 'Total', data: Array(24).fill(10) },
              { label: 'Blocked', data: Array(24).fill(2) },
            ],
          },
          topBlockedDomains: [{ domain: 'ads.tech', count: 50 }],
        },
      },
    });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'technitium',
      url: 'http://tech.local',
      token: 'tok',
    })) as DnsStats;
    expect(data.blockedPercent).toBe(25);
    expect(data.domainsBlocked).toBe(300);
    expect(data.series).toHaveLength(8);
  });
});
