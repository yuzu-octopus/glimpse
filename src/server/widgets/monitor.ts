import { monitorSchema, type MonitorConfig } from '../../shared/widgets/keyed';
import { parseCacheDuration } from '../cache';
import { registerWidget, type WidgetFetchContext } from './registry';
import type { MonitorSite } from '../../shared/widgets/payloads';

type DirectSite = NonNullable<MonitorConfig['sites']>[number];

function trimSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function checkDirectSite(ctx: WidgetFetchContext, site: DirectSite): Promise<MonitorSite> {
  const checkUrl = site['check-url'] ?? site.url;
  const start = performance.now();
  try {
    const headers: Record<string, string> | undefined = site['basic-auth']
      ? {
          Authorization: `Basic ${btoa(
            `${site['basic-auth'].username}:${site['basic-auth'].password}`,
          )}`,
        }
      : undefined;
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await ctx.fetch(checkUrl, {
          headers,
          signal: AbortSignal.timeout(parseCacheDuration(site.timeout, 3000)),
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }
    if (!res) throw lastErr ?? new Error('no response');
    const expected = site['expected-status-code'];
    const alts = new Set(site['alt-status-codes'] ?? []);
    const ok =
      expected !== undefined
        ? res.status === expected
        : res.status === 200 || alts.has(res.status);
    return {
      url: site.url,
      title: site.title ?? site.url,
      ok,
      status: res.status,
      ms: Math.round(performance.now() - start),
      errorUrl: site['error-url'] ?? null,
      sameTab: site['same-tab'] ?? false,
    };
  } catch {
    return {
      url: site.url,
      title: site.title ?? site.url,
      ok: false,
      status: null,
      ms: null,
      errorUrl: site['error-url'] ?? null,
      sameTab: site['same-tab'] ?? false,
    };
  }
}

interface KumaHeartbeat {
  status?: number;
  ping?: number | null;
}

interface KumaMonitorEntry {
  id?: number | string;
  name?: string;
  sendUrl?: string;
  url?: string;
}

/** Uptime Kuma pull source: public status-page API (`GET {url}/api/status-page/{slug}`). */
async function fetchKumaSites(
  ctx: WidgetFetchContext,
  kumaUrl: string,
  slug: string,
): Promise<MonitorSite[]> {
  const base = trimSlash(kumaUrl);
  const res = await ctx.fetch(`${base}/api/status-page/${slug}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`kuma status page responded ${res.status}`);
  const json = (await res.json()) as {
    publicGroupList?: Array<{ monitorList?: KumaMonitorEntry[] }>;
    heartbeatList?: Record<string, KumaHeartbeat[] | undefined>;
  };
  const out: MonitorSite[] = [];
  for (const group of json.publicGroupList ?? []) {
    for (const m of group.monitorList ?? []) {
      const beats = json.heartbeatList?.[String(m.id)] ?? [];
      const last = beats[beats.length - 1];
      const ok = last?.status === 1;
      out.push({
        url: m.sendUrl ?? m.url ?? base,
        title: m.name ?? String(m.id ?? 'monitor'),
        ok,
        status: ok ? 200 : null,
        ms: typeof last?.ping === 'number' ? Math.round(last.ping) : null,
        errorUrl: null,
        sameTab: false,
      });
    }
  }
  return out;
}

interface HealthchecksCheck {
  name?: string;
  slug?: string;
  status?: string;
}

/** Healthchecks push source: Management API v3 list-checks (read-only key suffices). */
async function fetchHealthchecksSites(
  ctx: WidgetFetchContext,
  baseUrl: string,
  key: string | undefined,
  tags: string[],
): Promise<MonitorSite[]> {
  const base = trimSlash(baseUrl);
  const qs = tags.map((t) => `tag=${encodeURIComponent(t)}`).join('&');
  const res = await ctx.fetch(`${base}/api/v3/checks/${qs ? `?${qs}` : ''}`, {
    headers: key ? { 'X-Api-Key': key } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`healthchecks responded ${res.status}`);
  const json = (await res.json()) as { checks?: HealthchecksCheck[] };
  return (json.checks ?? []).map((c) => {
    // "grace" missed a ping but hasn't failed yet — not a confirmed outage.
    const ok = c.status === 'up' || c.status === 'grace';
    return {
      url: base,
      title: c.name ?? c.slug ?? 'check',
      ok,
      status: null,
      ms: null,
      errorUrl: null,
      sameTab: false,
    };
  });
}

registerWidget('monitor', async (ctx, config) => {
  const cfg = monitorSchema.parse(config);

  // Config errors surface loudly; per-site/source runtime failures must not.
  for (const site of cfg.sites ?? []) {
    const checkUrl = site['check-url'] ?? site.url;
    if (checkUrl.startsWith('http://') && !site['allow-insecure']) {
      throw new Error(
        `monitor: "${site.title ?? site.url}" uses insecure http:// check-url; set allow-insecure: true to allow`,
      );
    }
  }
  const kumaActive = cfg['kuma-url'] !== undefined;
  const hcActive = cfg['healthchecks-key'] !== undefined || cfg['healthchecks-url'] !== undefined;
  const hcBase = cfg['healthchecks-url'] ?? 'https://healthchecks.io';
  for (const [label, url] of [
    ['kuma-url', cfg['kuma-url']],
    ['healthchecks-url', hcActive ? hcBase : undefined],
  ] as const) {
    if (url !== undefined && url.startsWith('http://') && !cfg['allow-insecure']) {
      throw new Error(`monitor: "${label}" uses insecure http:// URL; set allow-insecure: true to allow`);
    }
  }

  // Direct checks + uptime sources fan out together; source failures degrade to no rows.
  const [settled, kuma, hc] = await Promise.all([
    Promise.allSettled((cfg.sites ?? []).map((site) => checkDirectSite(ctx, site))),
    kumaActive
      ? fetchKumaSites(ctx, cfg['kuma-url']!, cfg['kuma-slug']!).catch(() => [] as MonitorSite[])
      : Promise.resolve([] as MonitorSite[]),
    hcActive
      ? fetchHealthchecksSites(ctx, hcBase, cfg['healthchecks-key'], cfg['healthchecks-tags'] ?? []).catch(
          () => [] as MonitorSite[],
        )
      : Promise.resolve([] as MonitorSite[]),
  ]);

  const sites: MonitorSite[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') sites.push(r.value);
  }
  sites.push(...kuma, ...hc);
  return { sites: cfg['show-failing-only'] ? sites.filter((s) => !s.ok) : sites };
});
