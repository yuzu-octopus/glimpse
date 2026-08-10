import { monitorSchema } from '../../shared/widgets/keyed';
import { registerWidget } from './registry';

export interface MonitorSite {
  url: string;
  title: string;
  ok: boolean;
  status: number | null;
  ms: number | null;
}

const TIMEOUT_MS = 5000;

registerWidget('monitor', async (ctx, config) => {
  const cfg = monitorSchema.parse(config);

  const settled = await Promise.allSettled(
    cfg.sites.map(async (site) => {
      const start = performance.now();
      try {
        const res = await ctx.fetch(site.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const expected = site['expected-status-code'] ?? 200;
        return {
          url: site.url,
          title: site.title ?? site.url,
          ok: res.status === expected,
          status: res.status,
          ms: Math.round(performance.now() - start),
        } as MonitorSite;
      } catch {
        return {
          url: site.url,
          title: site.title ?? site.url,
          ok: false,
          status: null,
          ms: null,
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
