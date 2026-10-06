import { systemStatsSchema } from '../../shared/widgets/system-stats';
import type { SystemStatsData } from '../../shared/widgets/payloads';
import { getDefaultTtl, parseCacheDuration } from '../cache';
import { registerWidget } from './registry';
import * as si from 'systeminformation';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── sysfs readers for hardware systeminformation has no API for ──

function readFanRpm(): number | null {
  try {
    for (const entry of readdirSync('/sys/class/hwmon')) {
      try {
        for (const fan of readdirSync(join('/sys/class/hwmon', entry)).filter((f) => /^fan\d+_input$/.test(f))) {
          const val = parseInt(readFileSync(join('/sys/class/hwmon', entry, fan), 'utf8').trim(), 10);
          if (!isNaN(val) && val > 0) return val;
        }
      } catch { /* skip unreadable hwmon entry */ }
    }
    return null;
  } catch { return null; }
}

function readGpuLoad(): number | null {
  try {
    let maxLoad: number | null = null;
    for (const card of readdirSync('/sys/class/drm').filter((c) => /^card\d+$/.test(c))) {
      try {
        for (const engine of readdirSync(join('/sys/class/drm', card, 'engine'))) {
          try {
            const val = parseInt(readFileSync(join('/sys/class/drm', card, 'engine', engine, 'busy'), 'utf8').trim(), 10);
            if (!isNaN(val) && (maxLoad === null || val > maxLoad)) maxLoad = val;
          } catch { /* skip unreadable engine */ }
        }
      } catch { /* skip unreadable card */ }
    }
    return maxLoad;
  } catch { return null; }
}

/** One row per device: /, /home, /root on the same nvme collapse to the
 *  root mount (else the shortest path). */
function dedupeFs<T extends { fs: string; mount: string }>(rows: T[]): T[] {
  const byDevice = new Map<string, T[]>();
  for (const row of rows) {
    const group = byDevice.get(row.fs);
    if (group) group.push(row);
    else byDevice.set(row.fs, [row]);
  }
  return Array.from(byDevice.values()).map((g) => g.find((r) => r.mount === '/') ?? g.reduce((a, b) => (a.mount.length <= b.mount.length ? a : b)));
}

registerWidget('system-stats', async (ctx, config) => {
  const cfg = systemStatsSchema.parse(config);
  const key = `system-stats:${JSON.stringify(cfg)}`;
  const ttl = parseCacheDuration(cfg.cache ?? '5s') || getDefaultTtl('system-stats');
  return ctx.singleflight.run(key, async () => {
    const cached = ctx.cache.get<SystemStatsData>(key);
    if (cached) return cached;
    try {
      const [cpu, mem, fs, temp, gpu, load, battery, time] = await Promise.all([
        (si.cpu as () => Promise<unknown>)().catch(() => null),
        (si.mem as () => Promise<unknown>)().catch(() => null),
        (si.fsSize as () => Promise<unknown>)().catch(() => []),
        (si.cpuTemperature as () => Promise<unknown>)().catch(() => ({ main: null })),
        (si.graphics as () => Promise<unknown>)().catch(() => ({ controllers: [] })),
        (si.currentLoad as () => Promise<unknown>)().catch(() => ({ currentLoad: null, avgLoad: null })),
        (si.battery as () => Promise<unknown>)().catch(() => null),
        Promise.resolve().then(() => (si.time as () => unknown)()).catch(() => null),
      ]);

      const cpuData = cpu as { cores?: number; speed?: number } | null;
      const memData = mem as { total?: number; active?: number; used?: number; available?: number; free?: number } | null;
      const fsData = (fs ?? []) as { fs: string; size: number; used: number; use: number; mount: string }[];
      const tempData = temp as { main?: number | null } | null;
      const gpuData = gpu as { controllers?: { model: string; temperatureGpu?: number | null }[] } | null;
      const loadData = load as { currentLoad?: number | null; avgLoad?: number | null } | null;
      const batteryData = battery as {
        hasBattery?: boolean; percent?: number; isCharging?: boolean;
        timeRemaining?: number | null; acConnected?: boolean;
        maxCapacity?: number; designedCapacity?: number;
      } | null;
      const timeData = time as { uptime?: number } | null;

      const fsRows = (Array.isArray(fsData) ? fsData : []).map((d) => ({
        fs: String(d.fs ?? ''),
        size: Number(d.size ?? 0),
        used: Number(d.used ?? 0),
        use: Number(d.use ?? 0),
        mount: String(d.mount ?? ''),
      }));

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
        fs: dedupeFs(fsRows),
        temp: tempData?.main ?? null,
        gpu: (gpuData?.controllers ?? []).map((c) => ({
          model: String(c.model ?? 'GPU'),
          temp: c.temperatureGpu ?? null,
        })),
        battery: batteryData?.hasBattery
          ? {
              percent: batteryData.percent ?? 0,
              status: batteryData.isCharging ? 'Charging' : 'Discharging',
              powerW: null,
              health: batteryData.maxCapacity && batteryData.designedCapacity
                ? Math.round((batteryData.maxCapacity / batteryData.designedCapacity) * 100)
                : null,
              onAc: batteryData.acConnected ?? null,
              hoursRemaining: batteryData.timeRemaining != null ? Math.round((batteryData.timeRemaining / 60) * 10) / 10 : null,
            }
          : null,
        uptimeHrs: timeData?.uptime != null ? Math.round((timeData.uptime / 3600) * 10) / 10 : null,
        load1m: loadData?.avgLoad ?? null,
        fanRpm: readFanRpm(),
        gpuLoad: readGpuLoad(),
      };
      ctx.cache.set(key, data, ttl);
      return data;
    } catch {
      return { cpu: null, mem: null, fs: [], temp: null, gpu: [], battery: null, uptimeHrs: null, load1m: null, fanRpm: null, gpuLoad: null } as SystemStatsData;
    }
  });
});
