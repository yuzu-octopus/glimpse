import Parser from 'rss-parser';
import { videosSchema } from '../../shared/widgets/keyed';
import { fetchText } from './http';
import { registerWidget } from './registry';
import type { Video } from '../../shared/widgets/payloads';

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
