import { monitorSchema } from '../../shared/widgets/keyed';
import { parseCacheDuration } from '../cache';
import { registerWidget } from './registry';
import type { MonitorSite } from '../../shared/widgets/payloads';

registerWidget('monitor', async (ctx, config) => {
  const cfg = monitorSchema.parse(config);

  // Config errors surface loudly; per-site network failures must not.
  for (const site of cfg.sites) {
    const checkUrl = site['check-url'] ?? site.url;
    if (checkUrl.startsWith('http://') && !site['allow-insecure']) {
      throw new Error(
        `monitor: "${site.title ?? site.url}" uses insecure http:// check-url; set allow-insecure: true to allow`,
      );
    }
  }

  const settled = await Promise.allSettled(
    cfg.sites.map(async (site) => {
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
        } as MonitorSite;
      } catch {
        return {
          url: site.url,
          title: site.title ?? site.url,
          ok: false,
          status: null,
          ms: null,
          errorUrl: site['error-url'] ?? null,
          sameTab: site['same-tab'] ?? false,
        } as MonitorSite;
      }
    }),
  );

  const sites: MonitorSite[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') sites.push(r.value);
  }
  return { sites: cfg['show-failing-only'] ? sites.filter((s) => !s.ok) : sites };
});
