import Parser from 'rss-parser';
import { videosSchema } from '../../shared/widgets/keyed';
import { fetchText } from './http';
import { registerWidget } from './registry';
import type { Video } from '../../shared/widgets/payloads';
import type { WidgetFetchContext } from './registry';

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
const CACHE_TTL_MS = 60 * 60 * 1000;

// ponytail: simple regex cache, handle lookup via youtube @ page (no API key) — kept as fallback, config prefers UC IDs
const handleChannelCache = new Map<string, string>();

function isChannelId(channel: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channel);
}

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
      if (!isChannelId(c) && !c.startsWith(PLAYLIST_PREFIX) && !c.startsWith('UC')) {
        const needsResolve = c.startsWith('@') || !isChannelId(c);
        if (needsResolve) {
          try {
            const handle = c.startsWith('@') ? c : `@${c}`;
            id = await resolveHandleToChannelId(ctx, handle);
          } catch {
            id = c;
          }
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
  try {
    const id = new URL(link).searchParams.get('v') ?? '';
    if (!id) return link || '#';
    return template ? template.replace('{VIDEO-ID}', id) : `https://www.youtube.com/watch?v=${id}`;
  } catch {
    return link || '#';
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
      const cached = ctx.cache.get<Video[]>(fullCacheKey);
      if (cached) return cached;
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
        ctx.cache.set(fullCacheKey, videos, CACHE_TTL_MS);
        return videos;
      } catch (err) {
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
