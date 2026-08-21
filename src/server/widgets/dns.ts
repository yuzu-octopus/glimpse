import { dnsStatsSchema } from '../../shared/widgets/dns';
import type { DnsStats } from '../../shared/widgets/payloads';
import { registerWidget } from './registry';

const BARS = 8;
const HOURS_SPAN = 24;
const HOURS_PER_BAR = HOURS_SPAN / BARS; // 3

function trimRight(s: string, ch: string): string {
  let i = s.length;
  while (i > 0 && s[i - 1] === ch) i--;
  return s.slice(0, i);
}

function fmtLabel(d: Date): string {
  const h = d.getHours();
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}${h < 12 ? 'am' : 'pm'}`;
}

function makeTimeLabels(): string[] {
  const now = Date.now();
  const labels: string[] = [];
  for (let h = HOURS_SPAN; h > 0; h -= HOURS_PER_BAR) {
    labels.push(fmtLabel(new Date(now - h * 3600_000)));
  }
  return labels;
}

function buildBars(
  queriesPerHour: number[],
  blockedPerHour: number[],
): Array<{ queries: number; blocked: number; percentBlocked: number; percentTotal: number }> {
  // pad/truncate to HOURS_SPAN from the right (most-recent window)
  let qs = queriesPerHour.slice();
  let bs = blockedPerHour.slice();
  if (qs.length > HOURS_SPAN) qs = qs.slice(qs.length - HOURS_SPAN);
  else if (qs.length < HOURS_SPAN) qs = [...Array(HOURS_SPAN - qs.length).fill(0), ...qs];
  if (bs.length > HOURS_SPAN) bs = bs.slice(bs.length - HOURS_SPAN);
  else if (bs.length < HOURS_SPAN) bs = [...Array(HOURS_SPAN - bs.length).fill(0), ...bs];

  const bars: Array<{ queries: number; blocked: number; percentBlocked: number; percentTotal: number }> = [];
  let maxQ = 0;
  for (let i = 0; i < BARS; i++) {
    let q = 0;
    let b = 0;
    for (let j = 0; j < HOURS_PER_BAR; j++) {
      q += qs[i * HOURS_PER_BAR + j] ?? 0;
      b += bs[i * HOURS_PER_BAR + j] ?? 0;
    }
    if (q > maxQ) maxQ = q;
    bars.push({ queries: q, blocked: b, percentBlocked: q > 0 ? Math.round((b / q) * 100) : 0, percentTotal: 0 });
  }
  for (const bar of bars) {
    bar.percentTotal = maxQ > 0 ? Math.round((bar.queries / maxQ) * 100) : 0;
  }
  return bars;
}

async function fetchAdguard(
  ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
  base: string,
  username: string,
  password: string,
  hideGraph: boolean,
  hideTopDomains: boolean,
): Promise<DnsStats> {
  const url = `${trimRight(base, '/')}/control/stats`;
  const headers: Record<string, string> = {};
  if (username || password) headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
  const res = await ctx.fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`AdGuard stats HTTP ${res.status} for ${url}`);
  const j = (await res.json()) as {
    num_dns_queries: number;
    dns_queries: number[];
    num_blocked_filtering: number;
    blocked_filtering: number[];
    avg_processing_time: number;
    top_blocked_domains?: Array<Record<string, number>>;
  };
  const totalQueries = j.num_dns_queries ?? 0;
  const blockedQueries = j.num_blocked_filtering ?? 0;
  const blockedPercent = totalQueries > 0 ? Math.round((blockedQueries / totalQueries) * 100) : 0;
  const responseTime = Math.round((j.avg_processing_time ?? 0) * 1000);
  const series = hideGraph ? [] : buildBars(j.dns_queries ?? [], j.blocked_filtering ?? []);
  let topBlockedDomains: DnsStats['topBlockedDomains'] = [];
  if (!hideTopDomains && j.top_blocked_domains) {
    const raw = j.top_blocked_domains.slice(0, 5);
    topBlockedDomains = raw
      .map((m) => {
        const domain = Object.keys(m)[0] ?? '';
        const count = m[domain] ?? 0;
        return { domain, percentBlocked: blockedQueries > 0 ? Math.round((count / blockedQueries) * 100) : 0 };
      })
      .filter((d) => d.domain);
  }
  return {
    totalQueries,
    blockedPercent,
    responseTime,
    domainsBlocked: 0,
    series,
    timeLabels: makeTimeLabels(),
    topBlockedDomains,
  };
}

async function fetchPiholeV5(
  ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
  base: string,
  token: string,
  hideGraph: boolean,
  hideTopDomains: boolean,
): Promise<DnsStats> {
  if (!token) throw new Error('missing API token for Pi-hole v5');
  const url = `${trimRight(base, '/')}/admin/api.php?summaryRaw&topItems&overTimeData10mins&auth=${encodeURIComponent(token)}`;
  const res = await ctx.fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pi-hole v5 HTTP ${res.status} for ${url}`);
  const j = (await res.json()) as {
    dns_queries_today: number;
    ads_blocked_today: number;
    ads_percentage_today: number;
    domains_being_blocked: number;
    domains_over_time?: Record<string, number> | unknown[];
    ads_over_time?: Record<string, number>;
    top_ads?: Record<string, number> | unknown[];
  };
  const totalQueries = j.dns_queries_today ?? 0;
  const blockedPercent = Math.round(j.ads_percentage_today ?? 0);
  const domainsBlocked = j.domains_being_blocked ?? 0;

  let topBlockedDomains: DnsStats['topBlockedDomains'] = [];
  if (!hideTopDomains) {
    const raw = j.top_ads && !Array.isArray(j.top_ads) ? (j.top_ads as Record<string, number>) : {};
    const entries = Object.entries(raw).map(([domain, count]) => ({
      domain,
      percentBlocked: (j.ads_blocked_today ?? 0) > 0 ? Math.round((count / j.ads_blocked_today) * 100) : 0,
    }));
    entries.sort((a, b) => b.percentBlocked - a.percentBlocked);
    topBlockedDomains = entries.slice(0, 5);
  }

  let series: DnsStats['series'] = [];
  if (!hideGraph) {
    const qsRaw = j.domains_over_time && !Array.isArray(j.domains_over_time) ? (j.domains_over_time as Record<string, number>) : {};
    const bsRaw = (j.ads_over_time as Record<string, number>) ?? {};
    const qKeys = Object.keys(qsRaw).map(Number).sort((a, b) => a - b);
    const bKeys = Object.keys(bsRaw).map(Number).sort((a, b) => a - b);
    // expect 144 points each; gracefully degrade to empty when not
    if (qKeys.length === 144 && bKeys.length === 144) {
      const qVals = qKeys.map((k) => qsRaw[String(k)] ?? 0);
      const bVals = bKeys.map((k) => bsRaw[String(k)] ?? 0);
      // aggregate 144 -> 8 bars of 18 points (glance), then via hourly helper:
      // convert 144 ten-min points -> 24 hourly (6 per hour) -> then bars helper
      const qHourly: number[] = [];
      const bHourly: number[] = [];
      for (let h = 0; h < 24; h++) {
        let q = 0;
        let b = 0;
        for (let p = 0; p < 6; p++) {
          q += qVals[h * 6 + p] ?? 0;
          b += bVals[h * 6 + p] ?? 0;
        }
        qHourly.push(q);
        bHourly.push(b);
      }
      series = buildBars(qHourly, bHourly);
    }
  }

  return {
    totalQueries,
    blockedPercent,
    responseTime: 0,
    domainsBlocked,
    series,
    timeLabels: makeTimeLabels(),
    topBlockedDomains,
  };
}

async function fetchPiholeV6(
  ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
  base: string,
  password: string,
  hideGraph: boolean,
  hideTopDomains: boolean,
): Promise<DnsStats> {
  const root = trimRight(base, '/');
  // auth
  const authRes = await ctx.fetch(`${root}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!authRes.ok) throw new Error(`Pi-hole v6 auth HTTP ${authRes.status}`);
  const authJson = (await authRes.json()) as { session?: { sid?: string }; error?: string };
  const sid = authJson.session?.sid;
  if (!sid) throw new Error('Pi-hole v6 auth: missing sid');

  const sidHeader = { 'x-ftl-sid': sid } as Record<string, string>;

  const summaryRes = await ctx.fetch(`${root}/api/stats/summary`, {
    headers: sidHeader,
    signal: AbortSignal.timeout(15_000),
  });
  if (!summaryRes.ok) throw new Error(`Pi-hole v6 summary HTTP ${summaryRes.status}`);
  const summary = (await summaryRes.json()) as {
    queries: { total: number; blocked: number; percent_blocked: number };
    gravity: { domains_being_blocked: number };
    took?: number;
  };

  let series: DnsStats['series'] = [];
  if (!hideGraph) {
    const histRes = await ctx.fetch(`${root}/api/history`, {
      headers: sidHeader,
      signal: AbortSignal.timeout(15_000),
    });
    if (histRes.ok) {
      const hist = (await histRes.json()) as { history: Array<{ timestamp: number; total: number; blocked: number }> };
      const h = hist.history ?? [];
      // v6 returns 145, drop first (oldest)
      const sliced = h.length === 145 ? h.slice(1) : h;
      if (sliced.length === 144) {
        const qHourly: number[] = [];
        const bHourly: number[] = [];
        for (let hour = 0; hour < 24; hour++) {
          let q = 0;
          let b = 0;
          for (let p = 0; p < 6; p++) {
            const idx = hour * 6 + p;
            q += sliced[idx]?.total ?? 0;
            b += sliced[idx]?.blocked ?? 0;
          }
          qHourly.push(q);
          bHourly.push(b);
        }
        series = buildBars(qHourly, bHourly);
      }
    }
  }

  let topBlockedDomains: DnsStats['topBlockedDomains'] = [];
  if (!hideTopDomains) {
    const topRes = await ctx.fetch(`${root}/api/stats/top_domains?blocked=true`, {
      headers: sidHeader,
      signal: AbortSignal.timeout(15_000),
    });
    if (topRes.ok) {
      const tj = (await topRes.json()) as { domains: Array<{ domain: string; count: number }> };
      const blocked = summary.queries?.blocked ?? 0;
      const raw = (tj.domains ?? []).slice(0, 5).map((d) => ({
        domain: d.domain,
        percentBlocked: blocked > 0 ? Math.round((d.count / blocked) * 100) : 0,
      }));
      raw.sort((a, b) => b.percentBlocked - a.percentBlocked);
      topBlockedDomains = raw;
    }
  }

  // responseTime: pihole summary has no latency; keep 0 so UI shows DOMAINS
  // For completeness, if `took` is present in summary top-domains it is query time, not DNS latency.
  return {
    totalQueries: summary.queries?.total ?? 0,
    blockedPercent: Math.round(summary.queries?.percent_blocked ?? 0),
    responseTime: 0,
    domainsBlocked: summary.gravity?.domains_being_blocked ?? 0,
    series,
    timeLabels: makeTimeLabels(),
    topBlockedDomains,
  };
}

async function fetchTechnitium(
  ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
  base: string,
  token: string,
  hideGraph: boolean,
  hideTopDomains: boolean,
): Promise<DnsStats> {
  if (!token) throw new Error('missing API token for Technitium');
  const url = `${trimRight(base, '/')}/api/dashboard/stats/get?token=${encodeURIComponent(token)}&type=LastDay`;
  const res = await ctx.fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Technitium HTTP ${res.status} for ${url}`);
  const j = (await res.json()) as {
    response: {
      stats: { totalQueries: number; blockedQueries: number; blockedZones?: number; blockListZones?: number };
      mainChartData?: { datasets: Array<{ label: string; data: number[] }> };
      topBlockedDomains?: Array<{ domainName: string; hits: number }>;
      topBlockedDomains_alt?: Array<{ domain: string; count: number }>;
    };
  };
  const st = j.response?.stats ?? { totalQueries: 0, blockedQueries: 0 };
  const totalQueries = st.totalQueries ?? 0;
  const blockedQueries = st.blockedQueries ?? 0;
  const blockedPercent = totalQueries > 0 ? Math.round((blockedQueries / totalQueries) * 100) : 0;
  const domainsBlocked = (st.blockedZones ?? 0) + (st.blockListZones ?? 0);

  let series: DnsStats['series'] = [];
  if (!hideGraph && j.response?.mainChartData?.datasets) {
    let qSeries: number[] = [];
    let bSeries: number[] = [];
    for (const ds of j.response.mainChartData.datasets) {
      if (ds.label === 'Total') qSeries = ds.data ?? [];
      if (ds.label === 'Blocked') bSeries = ds.data ?? [];
    }
    series = buildBars(qSeries, bSeries);
  }

  let topBlockedDomains: DnsStats['topBlockedDomains'] = [];
  if (!hideTopDomains) {
    // Technitium shape varies: prefer topBlockedDomains, fallback to alternate
    const rawDomains: Array<{ domain: string; count: number }> =
      ((j.response as unknown as { topBlockedDomains?: Array<{ domain: string; count: number }> }).topBlockedDomains as Array<{ domain: string; count: number }>) ??
      (j.response.topBlockedDomains as unknown as Array<{ domain: string; count: number }>) ??
      [];
    // also handle {domainName, hits}
    const alt = (j.response as unknown as { topBlockedDomains?: Array<{ domainName: string; hits: number }> }).topBlockedDomains as unknown as Array<{
      domainName: string;
      hits: number;
    }>;
    let normalized: Array<{ domain: string; count: number }> = rawDomains;
    if ((!rawDomains || rawDomains.length === 0) && Array.isArray(alt) && alt.length > 0 && 'domainName' in alt[0]) {
      normalized = (alt as Array<{ domainName: string; hits: number }>).slice(0, 5).map((d) => ({ domain: d.domainName, count: d.hits }));
    } else {
      normalized = (rawDomains ?? []).slice(0, 5);
    }
    topBlockedDomains = normalized.map((d) => ({
      domain: d.domain,
      percentBlocked: blockedQueries > 0 ? Math.round((d.count / blockedQueries) * 100) : 0,
    }));
  }

  return {
    totalQueries,
    blockedPercent,
    responseTime: 0,
    domainsBlocked,
    series,
    timeLabels: makeTimeLabels(),
    topBlockedDomains,
  };
}

registerWidget('dns-stats', async (ctx, config) => {
  const cfg = dnsStatsSchema.parse(config);
  const base = cfg.url;
  const hideGraph = cfg['hide-graph'] ?? false;
  const hideTopDomains = cfg['hide-top-domains'] ?? false;
  const service = cfg.service ?? 'pihole';

  // allow-insecure is a no-op for fetch (YAGNI over TLS hacks) — kept in schema for glance parity

  if (service === 'adguard') {
    return fetchAdguard(ctx, base, cfg.username ?? '', cfg.password ?? '', hideGraph, hideTopDomains);
  }
  if (service === 'technitium') {
    return fetchTechnitium(ctx, base, cfg.token ?? '', hideGraph, hideTopDomains);
  }
  // pihole (v6 with session when password present, fallback to v5)
  if (cfg.password) {
    try {
      return await fetchPiholeV6(ctx, base, cfg.password, hideGraph, hideTopDomains);
    } catch (e) {
      // Fallback to v5 when token available; else propagate v6 error
      if (cfg.token) return fetchPiholeV5(ctx, base, cfg.token, hideGraph, hideTopDomains);
      throw e;
    }
  }
  return fetchPiholeV5(ctx, base, cfg.token ?? '', hideGraph, hideTopDomains);
});
