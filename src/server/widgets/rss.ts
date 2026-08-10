import Parser from 'rss-parser';
import { rssSchema } from '../../shared/widgets/feeds';
import { registerWidget } from './registry';
import { fetchText } from './http';

export interface RssItem {
  title: string;
  url: string;
  published: string | null;
  source: string;
  thumbnail: string | null;
  description: string | null;
}

type ParserItem = Parser.Item & {
  mediaThumbnail?: { $?: { url?: string } };
  description?: string;
};

interface FeedSummary {
  title?: string;
  link?: string;
}

interface ParsedFeed {
  title?: string;
  items: ParserItem[];
}

registerWidget('rss', async (ctx, config) => {
  const cfg = rssSchema.parse(config);
  const parser = new Parser<FeedSummary, ParserItem>({
    customFields: { item: [['media:thumbnail', 'mediaThumbnail']] },
  });

  const settled = await Promise.allSettled(
    cfg.feeds.map(async (feed) => {
      const raw = await fetchText(ctx, feed.url, { headers: feed.headers });
      const parsed = (await parser.parseString(raw)) as ParsedFeed;
      const perFeedLimit = feed.limit ?? cfg.limit ?? 10;
      return parsed.items.slice(0, perFeedLimit).map((item) => ({
        title: item.title ?? '',
        url: item.link ?? '',
        published: item.isoDate ?? item.pubDate ?? null,
        source: feed.title ?? parsed.title ?? '',
        thumbnail:
          item.mediaThumbnail?.$?.url ?? item.enclosure?.url ?? null,
        description: item.contentSnippet ?? item.summary ?? null,
      })) as RssItem[];
    }),
  );

  const failed = settled.filter((r) => r.status === 'rejected');
  if (failed.length === cfg.feeds.length) {
    throw new Error('all RSS feeds failed to load');
  }

  let items: RssItem[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  if (!cfg['preserve-order']) {
    items.sort((a, b) => {
      const ta = a.published ? Date.parse(a.published) : 0;
      const tb = b.published ? Date.parse(b.published) : 0;
      return tb - ta;
    });
  }
  const limit = cfg.limit ?? 10;
  return { items: items.slice(0, limit) };
});
