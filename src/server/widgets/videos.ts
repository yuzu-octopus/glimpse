import Parser from 'rss-parser';
import { videosSchema } from '../../shared/widgets/keyed';
import { fetchText } from './http';
import { registerWidget } from './registry';

export interface Video {
  title: string;
  url: string;
  channel: string;
  published: string | null;
  thumbnail: string | null;
}

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

function feedUrlFor(channel: string): string {
  if (/^UC[A-Za-z0-9_-]{22}$/.test(channel)) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`;
  }
  const handle = channel.startsWith('@') ? channel.slice(1) : channel;
  return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(handle)}`;
}

registerWidget('videos', async (ctx, config) => {
  const cfg = videosSchema.parse(config);
  const parser = new Parser<VideoFeedSummary, ParserItem>({
    customFields: { item: [['media:group', 'mediaGroup']] },
  });

  const feeds = [
    ...cfg.channels.map((c) => ({ url: feedUrlFor(c), source: c })),
    ...cfg.playlists.map((p) => ({
      url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(p)}`,
      source: p,
    })),
  ];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source }) => {
      const raw = await fetchText(ctx, url);
      const parsed = (await parser.parseString(raw)) as ParsedFeed;
      return parsed.items.map((item) => ({
        title: item.title ?? '',
        url: item.link ?? '',
        channel: parsed.title ?? source,
        published: item.isoDate ?? item.pubDate ?? null,
        thumbnail:
          item.mediaGroup?.['media:thumbnail']?.[0]?.$?.url ??
          item.enclosure?.url ??
          null,
      })) as Video[];
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
