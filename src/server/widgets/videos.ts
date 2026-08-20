import Parser from 'rss-parser';
import { videosSchema } from '../../shared/widgets/keyed';
import { fetchText } from './http';
import { registerWidget } from './registry';
import type { Video } from '../../shared/widgets/payloads';
import type { WidgetFetchContext } from './registry';
import { STATIC_TTL_MS } from '../../shared/live';

type ParserItem = Parser.Item & {
  mediaGroup?: {
    'media:thumbnail'?: Array<{ $?: { url?: string } }>;
  };
};

interface VideoFeedSummary {
  title?: string;
}

interface ParsedFeed {
  title?: string;
  items: ParserItem[];
}

const YT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PLAYLIST_PREFIX = 'playlist:';

// ponytail: simple handle→UC cache, resolved via youtube @ page (no API key) — UC and @handle both work
const handleChannelCache = new Map<string, string>();

function isChannelId(channel: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channel);
}

// Why channel_id and not UULF (glance's UC→UULF playlist trick):
// Glance builds a playlist feed via UULF<id without UC> (the channel's uploads playlist).
// As of 2024-2025 YouTube returns empty/0 entries for that UULF feed for many channels,
// while ?channel_id=UC... remains populated and reliable. We therefore prefer
// https://www.youtube.com/feeds/videos.xml?channel_id=<UC...> directly. Handles (@handle)
// still work data-driven: resolveHandleToChannelId fetches https://www.youtube.com/@handle
// and extracts the UC id via regex on externalId/browseId/channelId, so config stays
// flexible — use UC... for stability or @handle for convenience (e.g. @spokeishere, @Bug-I).
function feedUrlForId(id: string, _includeShorts: boolean): string {
  if (id.startsWith(PLAYLIST_PREFIX)) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(id.slice(PLAYLIST_PREFIX.length))}`;
  }
  // Use channel_id feed directly; shorts filtered via link check (more reliable than UULF playlist which 404s for many channels)
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
}

export function extractChannelId(html: string): string | null {
  const patterns = [
    /"externalId":"(UC[^"]+)"/,
    /channel_id=(UC[A-Za-z0-9_-]{22,})/,
    /"channelId":"(UC[^"]+)"/,
    /"browseId":"(UC[^"]+)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

async function resolveHandleToChannelId(
  ctx: WidgetFetchContext,
  rawHandle: string,
): Promise<string> {
  const key = rawHandle.toLowerCase();
  const cached = handleChannelCache.get(key);
  if (cached) return cached;
  const clean = rawHandle.replace(/^@/, '');
  const html = await fetchText(ctx, `https://www.youtube.com/@${encodeURIComponent(clean)}`, {
    headers: { 'User-Agent': YT_UA },
  });
  const id = extractChannelId(html);
  if (!id) throw new Error(`Could not resolve handle @${clean} to channel_id`);
  handleChannelCache.set(key, id);
  return id;
}

async function feedUrlsForChannels(
  ctx: WidgetFetchContext,
  channels: string[],
  includeShorts: boolean,
): Promise<Array<{ url: string; source: string; cacheKey: string }>> {
  const results = await Promise.all(
    channels.map(async (c) => {
      let id = c;
      const isPlaylist = c.startsWith(PLAYLIST_PREFIX);
      const isUcLike = c.startsWith('UC');
      const isUcId = isChannelId(c);
      if (isUcId || isPlaylist || isUcLike) {
        // UC ID (or playlist:) — use directly; malformed UC falls through to feed fetch (404) without handle lookup
        id = c;
      } else if (c.startsWith('@')) {
        try {
          id = await resolveHandleToChannelId(ctx, c);
        } catch {
          id = c;
        }
      } else {
        // bare handle without @ (e.g. spokeishere, Bug-I) — try @handle resolution
        try {
          id = await resolveHandleToChannelId(ctx, `@${c}`);
        } catch {
          id = c;
        }
      }
      const url = feedUrlForId(id, includeShorts);
      const cacheKey = id;
      return { url, source: c, cacheKey };
    }),
  );
  return results;
}

function videoUrlFor(link: string, template: string | undefined): string {
  if (!template) return link;
  try {
    const id = new URL(link).searchParams.get('v') ?? '';
    if (!id) return link;
    return template.replace('{VIDEO-ID}', id).replace('{VIDEO-URL}', link);
  } catch {
    return link;
  }
}

registerWidget('videos', async (ctx, config) => {
  const cfg = videosSchema.parse(config);
  const includeShorts = cfg['include-shorts'] ?? false;
  const parser = new Parser<VideoFeedSummary, ParserItem>({
    customFields: { item: [['media:group', 'mediaGroup']] },
  });

  const channelFeeds = await feedUrlsForChannels(ctx, cfg.channels, includeShorts);
  const playlistFeeds = cfg.playlists.map((p) => {
    const pid = p.startsWith(PLAYLIST_PREFIX) ? p : `${PLAYLIST_PREFIX}${p}`;
    return { url: feedUrlForId(pid, includeShorts), source: p, cacheKey: pid };
  });
  const feeds = [...channelFeeds, ...playlistFeeds];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source, cacheKey }) => {
      const fullCacheKey = `videos:feed:${cacheKey}::${cfg['video-url-template'] ?? ''}::${includeShorts ? 'shorts' : 'noshorts'}`;
      const simpleCacheKey = `videos:feed:${cacheKey}`;
      const getCached = (): Video[] | undefined =>
        ctx.cache.get<Video[]>(fullCacheKey) ?? ctx.cache.get<Video[]>(simpleCacheKey);
      const setCached = (videos: Video[]) => {
        ctx.cache.set(fullCacheKey, videos, STATIC_TTL_MS);
        ctx.cache.set(simpleCacheKey, videos, STATIC_TTL_MS);
      };
      try {
        const raw = await fetchText(ctx, url, { headers: { 'User-Agent': YT_UA } });
        const parsed = (await parser.parseString(raw)) as ParsedFeed;
        const videos = parsed.items.flatMap((item) =>
          !includeShorts && (item.link ?? '').includes('/shorts/')
            ? []
            : [
                {
                  title: item.title ?? '',
                  url: videoUrlFor(item.link ?? '', cfg['video-url-template']),
                  channel: parsed.title ?? source,
                  published: item.isoDate ?? item.pubDate ?? null,
                  thumbnail:
                    item.mediaGroup?.['media:thumbnail']?.[0]?.$?.url ??
                    item.enclosure?.url ??
                    null,
                } as Video,
              ],
        );
        setCached(videos);
        return videos;
      } catch (err) {
        const cached = getCached();
        if (cached) return cached;
        throw err;
      }
    }),
  );

  const videos: Video[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') videos.push(...r.value);
  }
  videos.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });

  const limit = cfg.limit ?? 25;
  return { videos: videos.slice(0, limit) };
});
