import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

const mockOsInfo = vi.fn(async () => ({ hostname: 'yuzu-mac', platform: 'darwin', distro: 'macOS 26.0' }));
const mockCurrentLoad = vi.fn(async () => ({ avgLoad: 1.75 }));
const mockMem = vi.fn(async () => ({ total: 32e9, active: 12e9, used: 14e9 }));
const mockFsSize = vi.fn(async () => [
  { mount: '/', size: 500e9, used: 250e9 },
  { mount: '/System/Volumes/Data', size: 0, used: 0 }, // filtered out (no size)
]);
const mockTime = vi.fn(() => ({ uptime: 3600 * 24 * 2 }));

vi.mock('systeminformation', () => ({
  osInfo: () => mockOsInfo(),
  currentLoad: () => mockCurrentLoad(),
  mem: () => mockMem(),
  fsSize: () => mockFsSize(),
  time: () => mockTime(),
}));

// Import fetcher after mock
import './server-stats';
import { serverWidgets } from './registry';

function makeCtx(fetchImpl: typeof fetch = fetch): WidgetFetchContext {
  return {
    fetch: fetchImpl,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('server-stats')!;

describe('server-stats fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOsInfo.mockResolvedValue({ hostname: 'yuzu-mac', platform: 'darwin', distro: 'macOS 26.0' });
    mockCurrentLoad.mockResolvedValue({ avgLoad: 1.75 });
    mockMem.mockResolvedValue({ total: 32e9, active: 12e9, used: 14e9 });
    mockFsSize.mockResolvedValue([
      { mount: '/', size: 500e9, used: 250e9 },
      { mount: '/System/Volumes/Data', size: 0, used: 0 },
    ]);
    mockTime.mockReturnValue({ uptime: 3600 * 24 * 2 });
  });

  it('local default: returns rich ServerInfo shape', async () => {
    const res = (await fetcher()(makeCtx(), { type: 'server-stats' })) as {
      servers: {
        name: string;
        hostname: string;
        platform: string;
        bootTime: string;
        cpu: { load: number; loadIsAvailable: boolean };
        memory: { used: number; total: number; isAvailable: boolean };
        mountpoints: { path: string; used: number; total: number }[];
        isReachable: boolean;
      }[];
    };
    expect(res.servers).toHaveLength(1);
    const s = res.servers[0];
    expect(s.name).toBe('yuzu-mac');
    expect(s.hostname).toBe('yuzu-mac');
    expect(s.platform).toBe('macOS 26.0');
    expect(s.cpu.load).toBe(1.75);
    expect(s.cpu.loadIsAvailable).toBe(true);
    expect(s.memory.total).toBe(32e9);
    expect(s.memory.used).toBe(12e9);
    expect(s.memory.isAvailable).toBe(true);
    expect(s.mountpoints).toEqual([{ path: '/', used: 250e9, total: 500e9 }]);
    expect(s.isReachable).toBe(true);
    // bootTime = now - uptime(2d), ISO string
    expect(Date.now() - Date.parse(s.bootTime)).toBeGreaterThan(3600 * 47 * 1000);
  });

  it('respects cache — si not called twice within ttl', async () => {
    const ctx = makeCtx();
    await fetcher()(ctx, { type: 'server-stats' });
    await fetcher()(ctx, { type: 'server-stats' });
    expect(mockOsInfo).toHaveBeenCalledTimes(1);
  });

  it('remote server: fetches url/api/server-stats and uses payload', async () => {
    const remotePayload = {
      servers: [
        {
          name: 'box',
          hostname: 'box.lan',
          platform: 'Ubuntu 24.04',
          bootTime: new Date(Date.now() - 7200_000).toISOString(),
          cpu: { load: 0.5, loadIsAvailable: true },
          memory: { used: 2e9, total: 8e9, isAvailable: true },
          mountpoints: [{ path: '/srv', used: 1e9, total: 4e9 }],
          isReachable: true,
        },
      ],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(remotePayload), { status: 200 }));
    const res = (await fetcher()(
      makeCtx(fetchMock as unknown as typeof fetch),
      { type: 'server-stats', servers: [{ type: 'remote', url: 'https://box.lan/', name: 'My Box' }] },
    )) as { servers: { name: string; hostname: string; isReachable: boolean }[] };
    expect(fetchMock).toHaveBeenCalledWith('https://box.lan/api/server-stats', expect.anything());
    expect(res.servers[0].name).toBe('My Box'); // config name wins
    expect(res.servers[0].hostname).toBe('box.lan');
    expect(res.servers[0].isReachable).toBe(true);
  });

  it('unreachable remote degrades to unreachable entry, never throws', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    const res = (await fetcher()(
      makeCtx(fetchMock as unknown as typeof fetch),
      { type: 'server-stats', servers: [{ type: 'remote', url: 'https://down.lan' }] },
    )) as { servers: { name: string; hostname: string; isReachable: boolean; cpu: { loadIsAvailable: boolean } }[] };
    expect(res.servers[0].name).toBe('https://down.lan');
    expect(res.servers[0].hostname).toBe('down.lan');
    expect(res.servers[0].isReachable).toBe(false);
    expect(res.servers[0].cpu.loadIsAvailable).toBe(false);
  });

  it('local si failures degrade gracefully', async () => {
    mockOsInfo.mockRejectedValue(new Error('x'));
    mockCurrentLoad.mockRejectedValue(new Error('x'));
    mockMem.mockRejectedValue(new Error('x'));
    mockFsSize.mockRejectedValue(new Error('x'));
    const res = (await fetcher()(makeCtx(), { type: 'server-stats' })) as {
      servers: { name: string; cpu: { loadIsAvailable: boolean }; memory: { isAvailable: boolean }; mountpoints: unknown[]; isReachable: boolean }[];
    };
    const s = res.servers[0];
    expect(s.name).toBe('Local');
    expect(s.cpu.loadIsAvailable).toBe(false);
    expect(s.memory.isAvailable).toBe(false);
    expect(s.mountpoints).toEqual([]);
    expect(s.isReachable).toBe(true); // local machine is definitionally reachable
  });
});
