import { jellyfinSchema } from '../../shared/widgets/media';
import type { MediaData, MediaItem } from '../../shared/widgets/payloads';
import { fetchJson } from './http';
import { registerWidget } from './registry';

interface JellyfinUser {
  Id?: string;
}

interface JellyfinItem {
  Id: string;
  Name?: string | null;
  Type?: string | null;
  SeriesName?: string | null;
  SeasonName?: string | null;
  IndexNumber?: number | null;
  PremiereDate?: string | null;
  ProductionYear?: number | null;
}

function subtitleFor(item: JellyfinItem): string | null {
  if (item.Type === 'Episode' && item.SeriesName) {
    const ep = item.IndexNumber != null ? ` E${item.IndexNumber}` : '';
    return `${item.SeriesName}${item.SeasonName ? ` · ${item.SeasonName}` : ''}${ep}`;
  }
  if (item.Type === 'Season' && item.SeriesName) return item.SeriesName;
  return item.Type ?? null;
}

function toItem(base: string, item: JellyfinItem): MediaItem {
  return {
    title: item.Name ?? item.Id,
    subtitle: subtitleFor(item),
    poster: `${base}/Items/${item.Id}/Images/Primary?maxWidth=300&quality=80`,
    url: `${base}/web/index.html#!/details?id=${item.Id}`,
    date: item.PremiereDate ?? (item.ProductionYear != null ? String(item.ProductionYear) : null),
  };
}

registerWidget('jellyfin', async (ctx, config): Promise<MediaData> => {
  const cfg = jellyfinSchema.parse(config);
  const key = cfg['api-key'] ?? ctx.env.JELLYFIN_API_KEY;
  if (!key) throw new Error('jellyfin: missing api-key (set api-key or JELLYFIN_API_KEY)');
  const base = cfg.url.replace(/\/+$/, '');
  const headers = { 'X-Emby-Token': key, accept: 'application/json' };
  let userId = cfg['user-id'];
  if (!userId) {
    const users = await fetchJson<JellyfinUser[]>(ctx, `${base}/Users`, { headers });
    userId = users[0]?.Id;
    if (!userId) throw new Error('jellyfin: no users found on instance');
  }
  const items = await fetchJson<JellyfinItem[]>(
    ctx,
    `${base}/Users/${encodeURIComponent(userId)}/Items/Latest?Limit=${cfg.limit}&IncludeItemTypes=Movie,Episode,Series,Season`,
    { headers },
  );
  return { items: (Array.isArray(items) ? items : []).slice(0, cfg.limit).map((i) => toItem(base, i)) };
});
