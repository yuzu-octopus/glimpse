import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

const mockCpu = vi.fn(async () => ({ cores: 8, speed: 3.2 }));
const mockMem = vi.fn(async () => ({ total: 16e9, active: 8e9, available: 8e9 }));
const mockFsSize = vi.fn(async () => [{ fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/' }]);
const mockCpuTemp = vi.fn(async () => ({ main: 55 }));
const mockGraphics = vi.fn(async () => ({ controllers: [{ model: 'M5', temperatureGpu: 60 }] }));
const mockCurrentLoad = vi.fn(async () => ({ currentLoad: 42 }));

vi.mock('systeminformation', () => ({
  cpu: () => mockCpu(),
  mem: () => mockMem(),
  fsSize: () => mockFsSize(),
  cpuTemperature: () => mockCpuTemp(),
  graphics: () => mockGraphics(),
  currentLoad: () => mockCurrentLoad(),
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
    mockCurrentLoad.mockResolvedValue({ currentLoad: 42 });
  });

  it('returns shape and respects cache', async () => {
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as {
      cpu: { cores: number; speed: number | null; load: number | null };
      mem: { total: number; used: number; free: number } | null;
      fs: { mount: string }[];
      temp: number | null;
      gpu: { model: string }[];
    };
    expect(res.cpu.cores).toBe(8);
    expect(res.cpu.speed).toBe(3.2);
    expect(res.cpu.load).toBe(42);
    expect(res.mem?.total).toBe(16e9);
    expect(res.fs[0].mount).toBe('/');
    expect(res.temp).toBe(55);
    expect(res.gpu[0].model).toBe('M5');

    // second call hits cache (singleflight + TtlCache) — si not called again
    const res2 = (await fetcher()(ctx, { type: 'system-stats' })) as typeof res;
    expect(res2.cpu.cores).toBe(8);
    // cache should prevent second invocation: cpu called only once
    expect(mockCpu).toHaveBeenCalledTimes(1);
  });

  it('graceful null when cpu rejects (not on homelab)', async () => {
    mockCpu.mockRejectedValueOnce(new Error('no'));
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as {
      cpu: unknown;
      mem: unknown;
      fs: unknown[];
      temp: unknown;
      gpu: unknown[];
    };
    expect(res.cpu).toBeNull();
    expect(res.fs).toEqual(expect.any(Array));
    expect(res.gpu).toEqual(expect.any(Array));
    // should not throw
    expect(res).toBeDefined();
  });

  it('never throws when all si rejects', async () => {
    mockCpu.mockRejectedValueOnce(new Error('x'));
    mockMem.mockRejectedValueOnce(new Error('x'));
    mockFsSize.mockRejectedValueOnce(new Error('x'));
    mockCpuTemp.mockRejectedValueOnce(new Error('x'));
    mockGraphics.mockRejectedValueOnce(new Error('x'));
    mockCurrentLoad.mockRejectedValueOnce(new Error('x'));
    const ctx = makeCtx();
    const res = (await fetcher()(ctx, { type: 'system-stats' })) as {
      cpu: unknown;
      mem: unknown;
      fs: unknown[];
      temp: unknown;
      gpu: unknown[];
    };
    // per catch categories: cpu null, mem null, fs empty array, temp null, gpu empty
    expect(res.cpu).toBeNull();
    expect(res.mem).toBeNull();
    expect(res.fs).toEqual([]);
    expect(res.temp).toBeNull();
    expect(res.gpu).toEqual([]);
  });

  it('caches 5s default ttl', async () => {
    const ctx = makeCtx();
    const res1 = await fetcher()(ctx, { type: 'system-stats', cache: '5s' });
    expect(res1).toBeDefined();
    expect(mockCpu).toHaveBeenCalledTimes(1);
    // second call within ttl returns cached without new si calls
    await fetcher()(ctx, { type: 'system-stats', cache: '5s' });
    expect(mockCpu).toHaveBeenCalledTimes(1);
  });
});
