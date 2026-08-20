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

function isChannelId(channel: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channel);
}

function feedUrlFor(channel: string): string {
  if (isChannelId(channel)) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`;
  }
  const handle = channel.startsWith('@') ? channel.slice(1) : channel;
  // deprecated ?user= path kept for backward compat but YouTube no longer serves
  // handles via ?user= — callers should resolve handles to channel_id first
  return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(handle)}`;
}

// ponytail: simple regex cache, handle lookup via youtube @ page (no API key)
const handleChannelCache = new Map<string, string>();

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
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const id = extractChannelId(html);
  if (!id) throw new Error(`Could not resolve handle @${clean} to channel_id`);
  handleChannelCache.set(key, id);
  return id;
}

async function feedUrlsForChannels(
  ctx: WidgetFetchContext,
  channels: string[],
): Promise<Array<{ url: string; source: string }>> {
  const results = await Promise.all(
    channels.map(async (c) => {
      if (isChannelId(c)) {
        return { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${c}`, source: c };
      }
      if (c.startsWith('@')) {
        try {
          const id = await resolveHandleToChannelId(ctx, c);
          return { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, source: c };
        } catch {
          return { url: feedUrlFor(c), source: c };
        }
      }
      try {
        const id = await resolveHandleToChannelId(ctx, `@${c}`);
        return { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, source: c };
      } catch {
        return { url: feedUrlFor(c), source: c };
      }
    }),
  );
  return results;
}

/** Default link, or the configured template with {VIDEO-ID} from the v= param. */
function videoUrlFor(link: string, template: string | undefined): string {
  const id = new URL(link).searchParams.get('v') ?? '';
  return template
    ? template.replace('{VIDEO-ID}', id)
    : `https://www.youtube.com/watch?v=${id}`;
}

registerWidget('videos', async (ctx, config) => {
  const cfg = videosSchema.parse(config);
  const parser = new Parser<VideoFeedSummary, ParserItem>({
    customFields: { item: [['media:group', 'mediaGroup']] },
  });

  const channelFeeds = await feedUrlsForChannels(ctx, cfg.channels);
  const feeds = [
    ...channelFeeds,
    ...cfg.playlists.map((p) => ({
      url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(p)}`,
      source: p,
    })),
  ];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source }) => {
      const raw = await fetchText(ctx, url);
      const parsed = (await parser.parseString(raw)) as ParsedFeed;
      return parsed.items.flatMap((item) =>
        !cfg['include-shorts'] && (item.link ?? '').includes('/shorts/')
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

  const limit = cfg.limit ?? 10;
  return { videos: videos.slice(0, limit) };
});
