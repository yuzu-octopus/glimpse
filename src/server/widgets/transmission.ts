import { transmissionSchema } from '../../shared/widgets/media';
import type { TorrentData, TorrentItem } from '../../shared/widgets/payloads';
import { registerWidget } from './registry';

interface TransmissionTorrent {
  name?: string | null;
  percentDone?: number | null;
  status?: number | null;
  totalSize?: number | null;
  rateDownload?: number | null;
  rateUpload?: number | null;
  eta?: number | null;
}

interface RpcResponse {
  result?: string;
  arguments?: { torrents?: TransmissionTorrent[] };
}

const STATUS: Record<number, string> = {
  0: 'stopped',
  1: 'queued',
  2: 'checking',
  3: 'queued',
  4: 'downloading',
  5: 'queued',
  6: 'seeding',
};

function toItem(t: TransmissionTorrent): TorrentItem {
  return {
    name: t.name ?? 'unknown',
    progress: typeof t.percentDone === 'number' ? Math.min(1, Math.max(0, t.percentDone)) : 0,
    state: t.status != null ? (STATUS[t.status] ?? 'unknown') : 'unknown',
    size: t.totalSize ?? null,
    downloadSpeed: t.rateDownload ?? null,
    uploadSpeed: t.rateUpload ?? null,
    eta: t.eta != null && t.eta >= 0 ? t.eta : null,
  };
}

registerWidget('transmission', async (ctx, config): Promise<TorrentData> => {
  const cfg = transmissionSchema.parse(config);
  const base = cfg.url.replace(/\/+$/, '');
  const username = cfg.username ?? ctx.env.TRANSMISSION_USERNAME;
  const password = cfg.password ?? ctx.env.TRANSMISSION_PASSWORD;
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (username) headers.authorization = `Basic ${btoa(`${username}:${password ?? ''}`)}`;
  const payload = JSON.stringify({
    method: 'torrent-get',
    arguments: { fields: ['name', 'percentDone', 'status', 'totalSize', 'rateDownload', 'rateUpload', 'eta'] },
  });
  // Transmission guards RPC with a session id: first call 409s carrying
  // X-Transmission-Session-Id, which is replayed on the retry.
  let res = await ctx.fetch(`${base}/transmission/rpc`, { method: 'POST', headers, body: payload });
  if (res.status === 409) {
    const session = res.headers.get('x-transmission-session-id');
    if (!session) throw new Error('transmission: missing session id in 409 response');
    res = await ctx.fetch(`${base}/transmission/rpc`, {
      method: 'POST',
      headers: { ...headers, 'x-transmission-session-id': session },
      body: payload,
    });
  }
  if (!res.ok) throw new Error(`transmission: RPC failed with status ${res.status}`);
  const data = (await res.json()) as RpcResponse;
  if (data.result !== 'success') throw new Error(`transmission: RPC error ${data.result ?? 'unknown'}`);
  const torrents = data.arguments?.torrents ?? [];
  return { torrents: torrents.slice(0, cfg.limit).map(toItem) };
});
