import { qbittorrentSchema } from '../../shared/widgets/media';
import type { TorrentData, TorrentItem } from '../../shared/widgets/payloads';
import { fetchJson } from './http';
import { registerWidget } from './registry';

interface QbitTorrent {
  name?: string | null;
  progress?: number | null;
  state?: string | null;
  size?: number | null;
  dlspeed?: number | null;
  upspeed?: number | null;
  eta?: number | null;
}

function toItem(t: QbitTorrent): TorrentItem {
  return {
    name: t.name ?? 'unknown',
    progress: typeof t.progress === 'number' ? Math.min(1, Math.max(0, t.progress)) : 0,
    state: t.state ?? 'unknown',
    size: t.size ?? null,
    downloadSpeed: t.dlspeed ?? null,
    uploadSpeed: t.upspeed ?? null,
    eta: t.eta != null && t.eta >= 0 && t.eta < 8640000 ? t.eta : null,
  };
}

registerWidget('qbittorrent', async (ctx, config): Promise<TorrentData> => {
  const cfg = qbittorrentSchema.parse(config);
  const base = cfg.url.replace(/\/+$/, '');
  const username = cfg.username ?? ctx.env.QBITTORRENT_USERNAME ?? '';
  const password = cfg.password ?? ctx.env.QBITTORRENT_PASSWORD ?? '';
  // qBittorrent WebUI auth is cookie-based; Bun fetch keeps no jar, so the
  // SID cookie is captured from the login response and replayed manually.
  const login = await ctx.fetch(`${base}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/plain' },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  const body = await login.text();
  if (!login.ok || body === 'Fails.') throw new Error('qbittorrent: login failed (check username/password)');
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  const torrents = await fetchJson<QbitTorrent[]>(ctx, `${base}/api/v2/torrents/info`, {
    headers: cookie ? { cookie } : undefined,
  });
  return { torrents: (Array.isArray(torrents) ? torrents : []).slice(0, cfg.limit).map(toItem) };
});
