import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

const mockCpu = vi.fn(async () => ({ cores: 8, speed: 3.2 }));
const mockMem = vi.fn(async () => ({ total: 16e9, active: 8e9, available: 8e9 }));
const mockFsSize = vi.fn(async (): Promise<{ fs: string; type?: string; size: number; used: number; use: number; mount: string }[]> => [{ fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/' }]);
const mockCpuTemp = vi.fn(async () => ({ main: 55 }));
const mockGraphics = vi.fn(async () => ({ controllers: [{ model: 'M5', temperatureGpu: 60 }] }));
const mockCurrentLoad = vi.fn<() => Promise<{ currentLoad: number | null; avgLoad: number | null }>>(async () => ({ currentLoad: 42, avgLoad: 1.5 }));
const mockBattery = vi.fn<() => Promise<{ hasBattery: boolean; percent?: number; isCharging?: boolean; timeRemaining?: number | null; acConnected?: boolean; maxCapacity?: number; designedCapacity?: number }>>(async () => ({ hasBattery: true, percent: 85, isCharging: false, timeRemaining: 120, acConnected: false, maxCapacity: 5000, designedCapacity: 5500 }));
const mockTime = vi.fn(async () => ({ uptime: 7200 }));

vi.mock('systeminformation', () => ({
  cpu: () => mockCpu(),
  mem: () => mockMem(),
  fsSize: () => mockFsSize(),
  cpuTemperature: () => mockCpuTemp(),
  graphics: () => mockGraphics(),
  currentLoad: () => mockCurrentLoad(),
  battery: () => mockBattery(),
  time: () => mockTime(),
}));

// Import fetcher after mock
import './system-stats';
import { serverWidgets } from './registry';

function makeCtx(): WidgetFetchContext {
  return {
    fetch: fetch as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('system-stats')!;

describe('system-stats fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCpu.mockResolvedValue({ cores: 8, speed: 3.2 });
    mockMem.mockResolvedValue({ total: 16e9, active: 8e9, available: 8e9 });
    mockFsSize.mockResolvedValue([{ fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/' }]);
    mockCpuTemp.mockResolvedValue({ main: 55 });
    mockGraphics.mockResolvedValue({ controllers: [{ model: 'M5', temperatureGpu: 60 }] });
    mockCurrentLoad.mockResolvedValue({ currentLoad: 42, avgLoad: 1.5 });
    mockBattery.mockResolvedValue({ hasBattery: true, percent: 85, isCharging: false, timeRemaining: 120, acConnected: false, maxCapacity: 5000, designedCapacity: 5500 });
    mockTime.mockResolvedValue({ uptime: 7200 });
  });

  it('returns shape and respects cache', async () => {
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as {
      cpu: { cores: number; speed: number | null; load: number | null };
      mem: { total: number; used: number; free: number } | null;
      fs: { mount: string }[];
      temp: number | null;
      gpu: { model: string }[];
      battery: { percent: number; status: string; powerW: number | null; health: number | null; onAc: boolean | null; hoursRemaining: number | null } | null;
      uptimeHrs: number | null;
      load1m: number | null;
      fanRpm: number | null;
      gpuLoad: number | null;
    };
    expect(res.cpu.cores).toBe(8);
    expect(res.cpu.speed).toBe(3.2);
    expect(res.cpu.load).toBe(42);
    expect(res.mem?.total).toBe(16e9);
    expect(res.fs[0].mount).toBe('/');
    expect(res.temp).toBe(55);
    expect(res.gpu[0].model).toBe('M5');
    expect(res.battery?.percent).toBe(85);
    expect(res.battery?.status).toBe('Discharging');
    expect(res.battery?.health).toBe(91);
    expect(res.battery?.onAc).toBe(false);
    expect(res.battery?.hoursRemaining).toBe(2);
    expect(res.uptimeHrs).toBe(2);
    expect(res.load1m).toBe(1.5);

    // second call hits cache (singleflight + TtlCache) — si not called again
    const res2 = (await fetcher()(ctx, { type: 'system-stats' })) as typeof res;
    expect(res2.cpu.cores).toBe(8);
    // cache should prevent second invocation: cpu called only once
    expect(mockCpu).toHaveBeenCalledTimes(1);
  });

  it('never throws when all si rejects', async () => {
    mockCpu.mockRejectedValueOnce(new Error('x'));
    mockMem.mockRejectedValueOnce(new Error('x'));
    mockFsSize.mockRejectedValueOnce(new Error('x'));
    mockCpuTemp.mockRejectedValueOnce(new Error('x'));
    mockGraphics.mockRejectedValueOnce(new Error('x'));
    mockCurrentLoad.mockRejectedValueOnce(new Error('x'));
    mockBattery.mockRejectedValueOnce(new Error('x'));
    mockTime.mockRejectedValueOnce(new Error('x'));
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as {
      cpu: unknown;
      mem: unknown;
      fs: unknown[];
      temp: unknown;
      gpu: unknown[];
      battery: unknown;
      uptimeHrs: unknown;
      load1m: unknown;
      fanRpm: unknown;
      gpuLoad: unknown;
    };
    // per catch categories: cpu null, mem null, fs empty array, temp null, gpu empty
    expect(res.cpu).toBeNull();
    expect(res.mem).toBeNull();
    expect(res.fs).toEqual([]);
    expect(res.temp).toBeNull();
    expect(res.gpu).toEqual([]);
    expect(res.battery).toBeNull();
    expect(res.uptimeHrs).toBeNull();
    expect(res.load1m).toBeNull();
    expect(res.fanRpm).toBeNull();
    expect(res.gpuLoad).toBeNull();
  });

  it('caches for 5s by default when no cache string is configured', async () => {
    // The old version passed `cache: '5s'` on both calls, so the explicit
    // branch ran and the default never did. Crossing the boundary is the only
    // way to see which TTL was actually used.
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      await fetcher()(ctx, { type: 'system-stats' });
      expect(mockCpu).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(4_999);
      await fetcher()(ctx, { type: 'system-stats' });
      expect(mockCpu).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2);
      await fetcher()(ctx, { type: 'system-stats' });
      expect(mockCpu).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops pseudo-mounts, keeps the root mount and collapses one device', async () => {
    mockFsSize.mockResolvedValue([
      { fs: '/dev/nvme0n1p2', type: 'ext4', size: 500e9, used: 100e9, use: 20, mount: '/' },
      { fs: '/dev/nvme0n1p2', type: 'ext4', size: 500e9, used: 100e9, use: 20, mount: '/home' },
      { fs: '/dev/nvme0n1p2', type: 'ext4', size: 500e9, used: 100e9, use: 20, mount: '/root' },
      { fs: '/dev/nvme0n1p1', type: 'vfat', size: 1e9, used: 5e8, use: 50, mount: '/boot' },
      { fs: 'efivarfs', type: 'efivarfs', size: 1e6, used: 1e6, use: 100, mount: '/sys/firmware/efi/efivars' },
      { fs: 'tmpfs', type: 'tmpfs', size: 8e9, used: 1e6, use: 0, mount: '/run' },
    ]);
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { fs: { fs: string; mount: string }[] };
    // Default is root-only: efivarfs/tmpfs are not storage at all, and /boot —
    // real, but off the one-SSD story this card tells — is opt-in.
    expect(res.fs).toHaveLength(1);
    expect(res.fs[0].mount).toBe('/');
    expect(res.fs[0].fs).toBe('/dev/nvme0n1p2');
  });

  it('keeps every real mount when show-all-mounts is set', async () => {
    mockFsSize.mockResolvedValue([
      { fs: '/dev/nvme0n1p2', type: 'ext4', size: 500e9, used: 100e9, use: 20, mount: '/' },
      { fs: '/dev/nvme0n1p1', type: 'vfat', size: 1e9, used: 5e8, use: 50, mount: '/boot' },
      { fs: 'efivarfs', type: 'efivarfs', size: 1e6, used: 1e6, use: 100, mount: '/sys/firmware/efi/efivars' },
    ]);
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats', 'show-all-mounts': true })) as { fs: { mount: string }[] };
    expect(res.fs.map((f) => f.mount)).toEqual(['/', '/boot']);
  });

  it('keeps its mounts on a box with no root (Windows drive, chroot)', async () => {
    mockFsSize.mockResolvedValue([
      { fs: 'C:', type: 'NTFS', size: 500e9, used: 100e9, use: 20, mount: 'C:' },
    ]);
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { fs: { mount: string }[] };
    // An empty disk section answers less than a partial one.
    expect(res.fs.map((f) => f.mount)).toEqual(['C:']);
  });

  it('dedupes disk rows keeping shortest mount when no root', async () => {
    mockFsSize.mockResolvedValue([
      { fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/home' },
      { fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/home/user' },
    ]);
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { fs: { fs: string; mount: string }[] };
    expect(res.fs).toHaveLength(1);
    expect(res.fs[0].mount).toBe('/home');
  });

  it('returns null battery when hasBattery is false', async () => {
    mockBattery.mockResolvedValue({ hasBattery: false });
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { battery: unknown };
    expect(res.battery).toBeNull();
  });

  it('returns null battery when si.battery rejects', async () => {
    mockBattery.mockRejectedValueOnce(new Error('no battery'));
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { battery: unknown };
    expect(res.battery).toBeNull();
  });

  it('returns null uptime when si.time rejects', async () => {
    mockTime.mockRejectedValueOnce(new Error('no time'));
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { uptimeHrs: unknown };
    expect(res.uptimeHrs).toBeNull();
  });

  it('returns null load1m when avgLoad missing', async () => {
    mockCurrentLoad.mockResolvedValue({ currentLoad: 42, avgLoad: null });
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as { load1m: unknown };
    expect(res.load1m).toBeNull();
  });
});
