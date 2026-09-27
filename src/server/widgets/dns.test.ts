import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './dns';
import type { DnsStats } from '../../shared/widgets/payloads';
import { dnsStatsSchema } from '../../shared/widgets/dns';

function makeCtx(
  routes: Record<string, unknown> | ((url: string, init?: RequestInit) => unknown),
  env: Record<string, string | undefined> = {},
): WidgetFetchContext {
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const hit = typeof routes === 'function' ? (routes as (u: string, i?: RequestInit) => unknown)(url, init) : routes[url];
    if (hit === undefined) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    if (hit && typeof hit === 'object' && '__status' in (hit as Record<string, unknown>)) {
      const { __status, __body, __raw } = hit as { __status: number; __body?: unknown; __raw?: string };
      return new Response(__raw ?? JSON.stringify(__body), { status: __status });
    }
    return new Response(JSON.stringify(hit), { status: 200 });
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('dns-stats')!;

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Error) return e.message;
  }
  throw new Error('expected the fetch to reject');
}

describe('dns-stats fetcher', () => {
  it('fetches AdGuard stats and maps totals, latency, series and top domains', async () => {
    const qs = Array.from({ length: 24 }, (_, i) => 100 + i * 10);
    const bs = Array.from({ length: 24 }, (_, i) => 10 + i);
    const ctx = makeCtx(
      {
        'http://adguard.local/control/stats': {
          num_dns_queries: 5000,
          dns_queries: qs,
          num_blocked_filtering: 1000,
          blocked_filtering: bs,
          avg_processing_time: 0.012,
          top_blocked_domains: [{ 'ads.example': 400 }, { 'tracker.example': 300 }],
        },
      },
      { ADGUARD_USERNAME: 'admin', ADGUARD_PASSWORD: 'env-secret' },
    );
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'adguard',
      url: 'http://adguard.local',
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
    const ctx = makeCtx(routes, { PIHOLE_PASSWORD: 'env-pw' });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
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
    const ctx = makeCtx(routes, { PIHOLE_PASSWORD: 'env-pw' });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
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
    const ctx = makeCtx(routes as unknown as Record<string, unknown>, {
      PIHOLE_PASSWORD: 'env-pw',
      PIHOLE_TOKEN: 'tok',
    });
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
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
    const ctx = makeCtx(
      {
        'http://pihole.local/admin/api.php?summaryRaw&topItems&overTimeData10mins&auth=tok': {
          dns_queries_today: 300,
          ads_blocked_today: 0,
          ads_percentage_today: 0,
          domains_being_blocked: 10_000,
          domains_over_time: qsMap,
          ads_over_time: bsMap,
          top_ads: [],
        },
      },
      { PIHOLE_TOKEN: 'tok' },
    );
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'pihole',
      url: 'http://pihole.local',
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
    const ctx = makeCtx(
      {
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
      },
      { TECHNITIUM_TOKEN: 'tok' },
    );
    const data = (await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'technitium',
      url: 'http://tech.local',
    })) as DnsStats;
    expect(data.blockedPercent).toBe(25);
    expect(data.domainsBlocked).toBe(300);
    expect(data.series).toHaveLength(8);
  });

  it('ignores credentials left in the config and reads them from the env', async () => {
    const ctx = makeCtx(
      {
        'http://adguard.local/control/stats': {
          num_dns_queries: 10,
          dns_queries: Array(24).fill(1),
          num_blocked_filtering: 0,
          blocked_filtering: Array(24).fill(0),
          avg_processing_time: 0,
        },
      },
      { ADGUARD_USERNAME: 'envuser', ADGUARD_PASSWORD: 'envpass' },
    );
    await fetcher()(ctx, {
      type: 'dns-stats',
      service: 'adguard',
      url: 'http://adguard.local',
      username: 'leaked',
      password: 'leaked',
    });
    const inits = (ctx.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect((inits[0][1].headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa('envuser:envpass')}`,
    );
    expect((inits[0][1].headers as Record<string, string>).Authorization).not.toContain('leaked');
  });

  it('strips every credential the schema used to accept', () => {
    const parsed = dnsStatsSchema.parse({
      type: 'dns-stats',
      url: 'http://dns.local',
      token: 'leaked',
      password: 'leaked',
      username: 'leaked',
    });
    expect('token' in parsed).toBe(false);
    expect('password' in parsed).toBe(false);
    expect('username' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('leaked');
  });
});

// The widget's `url:` is the one place a user can still put a secret, and the
// API tokens travel in the query string. Every `throw` under test is a
// widget-local error: api.ts copies `e.message` verbatim into the NDJSON
// stream, the service worker caches it on disk, and WidgetChrome renders it —
// so a token in these strings is a token on the dashboard.
describe('dns-stats error messages never carry a credential', () => {
  const PIHOLE_TOKEN = 'pi_9f3c1d7b4e6a02f8_secret';
  const TECHNITIUM_TOKEN = 'tcn_5a8e0c3f_secret';
  const ADGUARD_PASSWORD = 'adguard-pw-7c1e_secret';
  const V6_PASSWORD = 'pihole-pw-2b9f_secret';

  /** Records every requested URL and answers each one with a non-ok body. */
  function failingCtx(env: Record<string, string | undefined>, status = 401) {
    const urls: string[] = [];
    const ctx = makeCtx((url: string) => {
      urls.push(url);
      return { __status: status, __body: { error: 'nope' } };
    }, env);
    return { ctx, urls };
  }

  it('Pi-hole v5: status and host survive, the auth token does not', async () => {
    const { ctx } = failingCtx({ PIHOLE_TOKEN });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }),
    );
    expect(msg).toContain('401');
    expect(msg).toContain('pihole.local');
    expect(msg).not.toContain(PIHOLE_TOKEN);
  });

  it('Technitium: status and host survive, the API token does not', async () => {
    const { ctx } = failingCtx({ TECHNITIUM_TOKEN });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'technitium', url: 'http://tech.local' }),
    );
    expect(msg).toContain('401');
    expect(msg).toContain('tech.local');
    expect(msg).not.toContain(TECHNITIUM_TOKEN);
  });

  it('AdGuard: userinfo in the base URL is dropped from the error', async () => {
    const { ctx } = failingCtx({ ADGUARD_USERNAME: 'admin', ADGUARD_PASSWORD });
    const msg = await messageOf(
      fetcher()(ctx, {
        type: 'dns-stats',
        service: 'adguard',
        url: `http://admin:${ADGUARD_PASSWORD}@adguard.local`,
      }),
    );
    expect(msg).toContain('401');
    expect(msg).toContain('adguard.local');
    expect(msg).not.toContain(ADGUARD_PASSWORD);
  });

  it('Pi-hole v6 → v5 fallback: the v5 error is sanitized too', async () => {
    const { ctx, urls } = failingCtx({ PIHOLE_PASSWORD: V6_PASSWORD, PIHOLE_TOKEN });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }),
    );
    expect(urls[0]).toContain('/api/auth');
    expect(urls.at(-1)).toContain('/admin/api.php');
    expect(msg).toContain('401');
    expect(msg).not.toContain(PIHOLE_TOKEN);
    expect(msg).not.toContain(V6_PASSWORD);
  });
});

// The v5 fallback is a degraded second attempt, so its status is the *later*
// fact: reporting only it tells the user nothing about the v6 failure that
// caused the fallback at all. api.ts copies `e.message` alone into
// `payload.error`, so both facts have to be in that one string — an Error
// `cause` chain would be dropped before it ever reached the Banner.
describe('Pi-hole v6 → v5 fallback keeps the v6 diagnosis', () => {
  const V6_PASSWORD = 'pihole-pw-2b9f_secret';
  const PIHOLE_TOKEN = 'pi_9f3c1d7b4e6a02f8_secret';
  it('names the v6 auth failure and the v5 fallback when both fail', async () => {
    const ctx = makeCtx(() => ({ __status: 401, __body: { error: 'nope' } }), {
      PIHOLE_PASSWORD: V6_PASSWORD,
      PIHOLE_TOKEN,
    });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }),
    );
    expect(msg).toContain('Pi-hole v6 auth HTTP 401');
    expect(msg).toMatch(/fallback/i);
    expect(msg).toContain('Pi-hole v5 HTTP 401');
    expect(msg).not.toContain(PIHOLE_TOKEN);
    expect(msg).not.toContain(V6_PASSWORD);
  });

  it('names a v6 failure from a later stage, and no session id escapes', async () => {
    const SESSION_ID = 'sid-2f8b41c9d7_secret';
    const ctx = makeCtx((url: string) => {
      if (url.endsWith('/api/auth')) return { session: { sid: SESSION_ID } };
      if (url.includes('/api/stats/summary')) return { __status: 500, __body: { error: 'boom' } };
      if (url.includes('/admin/api.php')) return { __status: 500, __body: { error: 'boom' } };
      return undefined;
    }, { PIHOLE_PASSWORD: V6_PASSWORD, PIHOLE_TOKEN });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }),
    );
    expect(msg).toContain('Pi-hole v6 summary HTTP 500');
    expect(msg).toMatch(/fallback/i);
    expect(msg).not.toContain(SESSION_ID);
    expect(msg).not.toContain(PIHOLE_TOKEN);
  });

  it('surfaces the v5 failure alone when there is no v6 attempt', async () => {
    const ctx = makeCtx(() => ({ __status: 401, __body: { error: 'nope' } }), { PIHOLE_TOKEN });
    const msg = await messageOf(
      fetcher()(ctx, { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }),
    );
    expect(msg).toBe('Pi-hole v5 HTTP 401 for http://pihole.local/admin/api.php?…');
  });
});

// FTL's v6 error body is an object, not a string: `{ error: { key, message,
// hint }, took }` (docs.pi-hole.net/api/auth). A bare status says what went
// wrong and never why, and the `hint` is the actionable half — the docs'
// own 400 example is a misrouted-endpoint hint naming the fix.
describe('Pi-hole v6 surfaces the FTL error reason', () => {
  const V6_PASSWORD = 'pihole-pw-2b9f_secret';
  const v6 = (
    routes: Parameters<typeof makeCtx>[0],
    env: Record<string, string | undefined> = { PIHOLE_PASSWORD: V6_PASSWORD },
  ) =>
    messageOf(fetcher()(makeCtx(routes, env), { type: 'dns-stats', service: 'pihole', url: 'http://pihole.local' }));

  it('falls back to `message` when the 401 carries no hint', async () => {
    const msg = await v6(() => ({
      __status: 401,
      __body: { error: { key: 'unauthorized', message: 'Unauthorized', hint: null }, took: 0.003 },
    }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 401: Unauthorized');
  });

  it("prefers the hint on a 400, the docs' own misrouted-endpoint example", async () => {
    const msg = await v6(() => ({
      __status: 400,
      __body: {
        error: {
          key: 'bad_request',
          message: 'Bad request',
          hint: 'The API is hosted at pi.hole/api, not pi.hole/admin/api',
        },
        took: 0.0001,
      },
    }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 400: The API is hosted at pi.hole/api, not pi.hole/admin/api');
  });

  it('carries the reason from the summary stage, not just auth', async () => {
    const msg = await v6((url: string) => {
      if (url.endsWith('/api/auth')) return { session: { sid: 'sid-2f8b41c9d7' } };
      if (url.includes('/api/stats/summary')) {
        return { __status: 401, __body: { error: { key: 'unauthorized', message: 'Session invalid', hint: null } } };
      }
      return undefined;
    });
    expect(msg).toBe('Pi-hole v6 summary HTTP 401: Session invalid');
  });

  it('carries the reason when a 200 auth body has no session', async () => {
    const msg = await v6(() => ({ error: { key: 'not_found', message: 'No session', hint: 'Re-run setup' } }));
    expect(msg).toBe('Pi-hole v6 auth: missing sid: Re-run setup');
  });

  // FTL is third-party and a 401 also comes from reverse proxies, so a body
  // that is absent, not JSON, or not the documented envelope must degrade to
  // the bare status rather than throw and mask the real failure.
  it.each([
    ['a string error, the shape the type claimed', { error: 'nope' }],
    ['an error with no usable fields', { error: { key: 'unauthorized' } }],
    ['fields of the wrong type', { error: { key: 'x', message: 42, hint: { text: 'no' } } }],
    ['no error at all', { took: 0.01 }],
    ['a JSON array', [1, 2, 3]],
    ['a bare JSON string', 'Unauthorized'],
  ])('degrades to the exact bare status for %s', async (_label, body) => {
    expect(await v6(() => ({ __status: 401, __body: body }))).toBe('Pi-hole v6 auth HTTP 401');
  });

  it('degrades to the bare status when the body is not JSON at all', async () => {
    const msg = await v6(() => ({ __status: 502, __raw: '<html><body>502 Bad Gateway</body></html>' }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 502');
  });

  it('degrades to the bare status when the body is empty', async () => {
    expect(await v6(() => ({ __status: 500, __body: undefined }))).toBe('Pi-hole v6 auth HTTP 500');
  });

  // The hint is server-supplied free text and this message reaches the
  // browser, the page cache and the service worker's Cache Storage (see
  // AGENTS.md), so a URL in it is sanitized like any other.
  it('sanitizes a query string embedded in the hint', async () => {
    const SECRET = 'ftl_sid_9f3c1d7b4e6a02f8';
    const msg = await v6(() => ({
      __status: 401,
      __body: {
        error: {
          key: 'unauthorized',
          message: 'Unauthorized',
          hint: `Session http://pihole.local/api/auth?sid=${SECRET} has expired`,
        },
      },
    }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 401: Session http://pihole.local/api/auth?… has expired');
    expect(msg).not.toContain(SECRET);
  });

  it('leaves prose that merely looks URL-ish alone', async () => {
    const msg = await v6(() => ({
      __status: 400,
      __body: { error: { key: 'bad_request', message: 'Bad request', hint: 'use pi.hole/api, not pi.hole/admin/api' } },
    }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 400: use pi.hole/api, not pi.hole/admin/api');
  });

  it('caps an oversized hint so it cannot flood the Banner', async () => {
    const msg = await v6(() => ({ __status: 500, __body: { error: { key: 'e', message: 'm', hint: 'x'.repeat(300) } } }));
    const reason = msg.slice('Pi-hole v6 auth HTTP 500: '.length);
    expect(reason).toHaveLength(160);
    expect(reason.endsWith('…')).toBe(true);
  });

  it('flattens newlines so the reason stays one clause', async () => {
    const msg = await v6(() => ({
      __status: 400,
      __body: { error: { key: 'bad_request', message: 'm', hint: 'first line\nsecond line\r\nthird' } },
    }));
    expect(msg).toBe('Pi-hole v6 auth HTTP 400: first line second line third');
  });

  // cee455a joins the two attempts with `;` into one message because api.ts
  // copies `e.message` alone into `payload.error`. A reason on the v6 half
  // must not double up or garble that join.
  it('composes with the v5 fallback join without doubling the clause', async () => {
    const msg = await v6(
      () => ({
        __status: 400,
        __body: { error: { key: 'bad_request', message: 'Bad request', hint: 'The API is hosted at pi.hole/api' } },
      }),
      { PIHOLE_PASSWORD: V6_PASSWORD, PIHOLE_TOKEN: 'pi_9f3c1d7b4e6a02f8_secret' },
    );
    expect(msg).toBe(
      'Pi-hole v6 auth HTTP 400: The API is hosted at pi.hole/api' +
        '; the v5 fallback failed too: Pi-hole v5 HTTP 400 for http://pihole.local/admin/api.php?…',
    );
  });
});
