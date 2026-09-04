import { immichSchema } from '../../shared/widgets/media';
import type { MediaData, MediaItem } from '../../shared/widgets/payloads';
import { fetchJson } from './http';
import { registerWidget } from './registry';

interface ImmichAsset {
  id: string;
  originalFileName?: string | null;
  localDateTime?: string | null;
  fileCreatedAt?: string | null;
}

interface ImmichSearchResponse {
  assets?: { items?: ImmichAsset[] } | ImmichAsset[];
}

function toItem(base: string, a: ImmichAsset): MediaItem {
  const name = a.originalFileName?.split('/').pop() || a.id;
  return {
    title: name,
    subtitle: null,
    poster: `${base}/api/assets/${a.id}/thumbnail`,
    url: `${base}/photos/${a.id}`,
    date: a.localDateTime ?? a.fileCreatedAt ?? null,
  };
}

registerWidget('immich', async (ctx, config): Promise<MediaData> => {
  const cfg = immichSchema.parse(config);
  const key = cfg['api-key'] ?? ctx.env.IMMICH_API_KEY;
  if (!key) throw new Error('immich: missing api-key (set api-key or IMMICH_API_KEY)');
  const base = cfg.url.replace(/\/+$/, '');
  const res = await fetchJson<ImmichSearchResponse>(ctx, `${base}/api/search/metadata`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ order: 'desc', size: cfg.limit, type: 'IMAGE' }),
  });
  const assets = Array.isArray(res.assets) ? res.assets : (res.assets?.items ?? []);
  return { items: assets.slice(0, cfg.limit).map((a) => toItem(base, a)) };
});
