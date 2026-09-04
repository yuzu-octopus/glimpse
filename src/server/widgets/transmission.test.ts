import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './transmission';
import type { TorrentData } from '../../shared/widgets/payloads';

const RPC_FIXTURE = {
  result: 'success',
  arguments: {
    torrents: [
      { name: 'ubuntu.iso', percentDone: 0.42, status: 4, totalSize: 4_000_000_000, rateDownload: 12_000_000, rateUpload: 0, eta: 300 },
      { name: 'seed.mkv', percentDone: 1, status: 6, totalSize: 800_000_000, rateDownload: 0, rateUpload: 500_000, eta: -1 },
    ],
  },
};

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('transmission')!;

describe('transmission fetcher', () => {
  it('retries the 409 with the session id then maps torrents', async () => {
    const seen: Array<Record<string, string>> = [];
    const ctx = makeCtx(async (_url, init) => {
      seen.push({ ...(init?.headers as Record<string, string>) });
      if (!seen[seen.length - 1]['x-transmission-session-id']) {
        return new Response('conflict', { status: 409, headers: { 'x-transmission-session-id': 'sess1' } });
      }
      return new Response(JSON.stringify(RPC_FIXTURE), { status: 200 });
    });
    const data = (await fetcher()(ctx, { type: 'transmission', url: 'http://tr.lab:9091' })) as TorrentData;
    expect(seen).toHaveLength(2);
    expect(data.torrents).toHaveLength(2);
    expect(data.torrents[0]).toEqual({
      name: 'ubuntu.iso',
      progress: 0.42,
      state: 'downloading',
      size: 4_000_000_000,
      downloadSpeed: 12_000_000,
      uploadSpeed: 0,
      eta: 300,
    });
    expect(data.torrents[1].state).toBe('seeding');
    expect(data.torrents[1].eta).toBeNull();
  });

  it('throws on RPC errors', async () => {
    const ctx = makeCtx(async () => new Response(JSON.stringify({ result: 'nope' }), { status: 200 }));
    await expect(fetcher()(ctx, { type: 'transmission', url: 'http://tr.lab:9091' })).rejects.toThrow(/RPC error/i);
  });

  it('skips the retry when no 409 arrives', async () => {
    let calls = 0;
    const ctx = makeCtx(async () => { calls++; return new Response(JSON.stringify(RPC_FIXTURE), { status: 200 }); });
    const data = (await fetcher()(ctx, { type: 'transmission', url: 'http://tr.lab:9091/', limit: 1 })) as TorrentData;
    expect(calls).toBe(1);
    expect(data.torrents).toHaveLength(1);
  });
});
