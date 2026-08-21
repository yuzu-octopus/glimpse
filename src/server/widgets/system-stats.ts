import { systemStatsSchema } from '../../shared/widgets/system-stats';
import type { SystemStatsData } from '../../shared/widgets/payloads';
import { getDefaultTtl, parseCacheDuration } from '../cache';
import { registerWidget } from './registry';
import * as si from 'systeminformation';

registerWidget('system-stats', async (ctx, config) => {
  const cfg = systemStatsSchema.parse(config);
  const key = `system-stats:${JSON.stringify(cfg)}`;
  const ttl = parseCacheDuration(cfg.cache ?? '5s') || getDefaultTtl('system-stats');
  return ctx.singleflight.run(key, async () => {
    const cached = ctx.cache.get<SystemStatsData>(key);
    if (cached) return cached;
    try {
      const [cpu, mem, fs, temp, gpu, load] = await Promise.all([
        (si.cpu as () => Promise<unknown>)().catch(() => null) as Promise<unknown>,
        (si.mem as () => Promise<unknown>)().catch(() => null) as Promise<unknown>,
        (si.fsSize as () => Promise<unknown>)().catch(() => []) as Promise<unknown>,
        (si.cpuTemperature as () => Promise<unknown>)().catch(() => ({ main: null })) as Promise<unknown>,
        (si.graphics as () => Promise<unknown>)().catch(() => ({ controllers: [] })) as Promise<unknown>,
        (si.currentLoad as () => Promise<unknown>)().catch(() => ({ currentLoad: null })) as Promise<unknown>,
      ]);

      const cpuData = cpu as { cores?: number; speed?: number } | null;
      const memData = mem as { total?: number; active?: number; used?: number; available?: number; free?: number } | null;
      const fsData = (fs ?? []) as { fs: string; size: number; used: number; use: number; mount: string }[];
      const tempData = temp as { main?: number | null } | null;
      const gpuData = gpu as { controllers?: { model: string; temperatureGpu?: number | null }[] } | null;
      const loadData = load as { currentLoad?: number | null } | null;

      const data: SystemStatsData = {
        cpu: cpuData
          ? { cores: cpuData.cores ?? 0, speed: (cpuData.speed as number | null) ?? null, load: loadData?.currentLoad ?? null }
          : null,
        mem: memData
          ? {
              total: memData.total ?? 0,
              used: (memData.active ?? memData.used ?? 0) as number,
              free: (memData.available ?? memData.free ?? 0) as number,
            }
          : null,
        fs: (Array.isArray(fsData) ? fsData : []).map((d) => ({
          fs: String(d.fs ?? ''),
          size: Number(d.size ?? 0),
          used: Number(d.used ?? 0),
          use: Number(d.use ?? 0),
          mount: String(d.mount ?? ''),
        })),
        temp: tempData?.main ?? null,
        gpu: (gpuData?.controllers ?? []).map((c) => ({
          model: String(c.model ?? 'GPU'),
          temp: c.temperatureGpu ?? null,
        })),
      };
      ctx.cache.set(key, data, ttl);
      return data;
    } catch {
      return { cpu: null, mem: null, fs: [], temp: null, gpu: [] } as SystemStatsData;
    }
  });
});
