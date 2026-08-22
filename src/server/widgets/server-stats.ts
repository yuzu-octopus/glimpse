import { serverStatsSchema } from '../../shared/widgets/server-stats';
import type { ServerInfo, ServerStatsData } from '../../shared/widgets/payloads';
import { getDefaultTtl, parseCacheDuration } from '../cache';
import { registerWidget } from './registry';
import * as si from 'systeminformation';

const REMOTE_TIMEOUT_MS = 5_000;

/** Collect stats for the machine this Glimpse runs on. Every si call is
 * individually guarded so a missing sensor degrades to "unavailable", not
 * an error — same philosophy as system-stats. */
async function localServer(name?: string): Promise<ServerInfo> {
  const [os, load, mem, fs] = await Promise.all([
    (si.osInfo as () => Promise<unknown>)().catch(() => null),
    (si.currentLoad as () => Promise<unknown>)().catch(() => null) as Promise<{ avgLoad?: number | null } | null>,
    (si.mem as () => Promise<unknown>)().catch(() => null),
    (si.fsSize as () => Promise<unknown>)().catch(() => []) as Promise<{ mount?: string; size?: number; used?: number }[]>,
  ]);
  const time = (() => {
    try {
      return (si.time as unknown as () => { uptime?: number })();
    } catch {
      return { uptime: 0 };
    }
  })();
  const [temp, graphics] = await Promise.all([
    (async () => {
      try {
        const fn = (si as unknown as Record<string, unknown>).cpuTemperature as (() => Promise<{ main?: number | null }>) | undefined;
        return fn ? await fn().catch(() => null) : null;
      } catch {
        return null;
      }
    })() as Promise<{ main?: number | null } | null>,
    (async () => {
      try {
        const fn = (si as unknown as Record<string, unknown>).graphics as (() => Promise<{ controllers?: Array<{ model?: string; temperatureGpu?: number | null }> }>) | undefined;
        return fn ? await fn().catch(() => null) : null;
      } catch {
        return null;
      }
    })() as Promise<{ controllers?: Array<{ model?: string; temperatureGpu?: number | null }> } | null>,
  ]);

  const osData = os as { hostname?: string; platform?: string; distro?: string } | null;
  const memData = mem as { total?: number; active?: number; used?: number } | null;
  const uptime = (time as { uptime?: number })?.uptime ?? null;
  const tempData = temp as { main?: number | null } | null;
  const gpuData = graphics as { controllers?: Array<{ model?: string; temperatureGpu?: number | null }> } | null;

  return {
    name: name ?? osData?.hostname ?? 'Local',
    hostname: osData?.hostname ?? '',
    platform: osData?.distro || osData?.platform || '',
    bootTime: uptime != null ? new Date(Date.now() - uptime * 1000).toISOString() : '',
    cpu: {
      load: Number(load?.avgLoad ?? 0),
      loadIsAvailable: load?.avgLoad != null,
    },
    memory: {
      total: memData?.total ?? 0,
      used: (memData?.active ?? memData?.used ?? 0) as number,
      isAvailable: !!memData,
    },
    mountpoints: (() => {
      const out: ServerInfo['mountpoints'] = [];
      const seen = new Set<string>();
      for (const d of Array.isArray(fs) ? (fs as Array<Record<string, unknown>>) : []) {
        if (!d.mount || !d.size) continue;
        const p = String(d.mount);
        if (
          p.includes('cryptexd') ||
          p.includes('MobileAsset') ||
          p === '/System/Volumes/VM' ||
          p === '/System/Volumes/Preboot' ||
          p === '/System/Volumes/Update' ||
          p === '/System/Volumes/xarts' ||
          p === '/System/Volumes/iSCPreboot' ||
          p === '/System/Volumes/Hardware'
        )
          continue;
        if (seen.has(p)) continue;
        seen.add(p);
        out.push({ path: p, used: Number(d.used ?? 0), total: Number(d.size ?? 0) });
      }
      return out;
    })(),
    temp: tempData?.main != null ? { main: tempData.main, isAvailable: true } : { main: null, isAvailable: false },
    gpu: (() => {
      const out: Array<{ model: string; temp: number | null }> = [];
      if (!Array.isArray(gpuData?.controllers)) return out;
      for (const c of gpuData.controllers as Array<Record<string, unknown>>) {
        if (!c.model) continue;
        out.push({ model: String(c.model), temp: (c.temperatureGpu as number | null) ?? null });
      }
      return out;
    })(),
    isReachable: true,
  };
}

/** Pull the same payload from another Glimpse instance's /api/server-stats.
 * Unreachable servers degrade to an unreachable entry instead of failing
 * the whole widget. */
async function remoteServer(url: string, name: string | undefined, ctxFetch: typeof fetch): Promise<ServerInfo> {
  const base = url.replace(/\/+$/, '');
  try {
    const res = await ctxFetch(`${base}/api/server-stats`, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as Partial<ServerStatsData>;
    const first = body.servers?.[0];
    if (!first) throw new Error('empty payload');
    return { ...first, name: name ?? first.name };
  } catch {
    return {
      name: name ?? base,
      hostname: base.replace(/^https?:\/\//, ''),
      platform: '',
      bootTime: '',
      cpu: { load: 0, loadIsAvailable: false },
      memory: { used: 0, total: 0, isAvailable: false },
      mountpoints: [],
      isReachable: false,
    };
  }
}

registerWidget('server-stats', async (ctx, config) => {
  const cfg = serverStatsSchema.parse(config);
  const key = `server-stats:${JSON.stringify(cfg.servers)}`;
  const ttl = parseCacheDuration(cfg.cache) || getDefaultTtl('system-stats');
  return ctx.singleflight.run(key, async () => {
    const cached = ctx.cache.get<ServerStatsData>(key);
    if (cached) return cached;
    const servers = await Promise.all(
      cfg.servers.map((s) =>
        s.type === 'remote' && s.url ? remoteServer(s.url, s.name, ctx.fetch) : localServer(s.name),
      ),
    );
    const data: ServerStatsData = { servers };
    ctx.cache.set(key, data, ttl);
    return data;
  });
});
