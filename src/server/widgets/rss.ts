import { RSS_DEFAULTS, rssSchema } from '../../shared/widgets/feeds';
import { registerWidget } from './registry';
import { fetchText } from './http';
import { widgetLimit } from './runtime';
import { getBXML } from './xml';
import type { RssItem } from '../../shared/widgets/payloads';

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textVal(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    const t = (v as Record<string, unknown>)['#text'];
    if (typeof t === 'string') return t;
  }
  return undefined;
}

function linkVal(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['@href'] === 'string') return o['@href'] as string;
    if (typeof o['#text'] === 'string') return o['#text'] as string;
    if (typeof o.href === 'string') return o.href as string;
  }
  return undefined;
}

function extractThumbnail(item: Record<string, unknown>): string | null {
  const mt = item['media:thumbnail'] as unknown;
  if (mt && typeof mt === 'object') {
    const o = mt as Record<string, unknown>;
    if (typeof o['@url'] === 'string') return o['@url'] as string;
  }
  const enc = item.enclosure as unknown;
  if (enc && typeof enc === 'object') {
    const o = enc as Record<string, unknown>;
    if (typeof o['@url'] === 'string') return o['@url'] as string;
  }
  return null;
}

function extractCategories(item: Record<string, unknown>): string[] {
  const cats: string[] = [];
  const raw = item.category ?? item.categories;
  for (const c of asArray(raw as unknown)) {
    if (typeof c === 'string') cats.push(c);
    else if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      if (typeof o['@term'] === 'string') cats.push(o['@term'] as string);
      else if (typeof o['#text'] === 'string') cats.push(o['#text'] as string);
      else if (typeof o.term === 'string') cats.push(o.term as string);
    }
  }
  return cats;
}

function parseFeed(raw: string): { title?: string; items: Array<Record<string, unknown>> } {
  const parsed = getBXML().parse(raw) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  if (rss) {
    const channel = rss.channel as Record<string, unknown> | undefined;
    if (channel) {
      const title = textVal(channel.title);
      const items = asArray(channel.item as unknown).map((it) => it as Record<string, unknown>);
      return { title, items };
    }
  }
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) {
    const title = textVal(feed.title);
    const entries = asArray(feed.entry as unknown).map((e) => e as Record<string, unknown>);
    return { title, items: entries };
  }
  return { title: undefined, items: [] };
}

function itemTitle(item: Record<string, unknown>): string {
  return textVal(item.title) ?? '';
}

function itemLink(item: Record<string, unknown>): string {
  const raw = item.link;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    for (const l of raw) {
      const v = linkVal(l);
      if (v) return v;
    }
    return '';
  }
  const v = linkVal(raw);
  if (v) return v;
  return '';
}

function itemPublished(item: Record<string, unknown>): string | null {
  return (
    textVal(item.isoDate) ??
    textVal(item.pubDate) ??
    textVal(item.published) ??
    textVal(item.updated) ??
    textVal(item.pubdate) ??
    null
  );
}

function itemDescription(item: Record<string, unknown>): string | null {
  return (
    textVal(item.description) ??
    textVal(item.summary) ??
    textVal(item.content) ??
    (typeof item['content:encoded'] === 'string' ? (item['content:encoded'] as string) : textVal(item['content:encoded'])) ??
    textVal(item['media:description']) ??
    null
  );
}

registerWidget('rss', async (ctx, config) => {
  const cfg = rssSchema.parse(config);
  const settled = await Promise.allSettled(
    cfg.feeds.map(async (feed) => {
      const raw = await fetchText(ctx, feed.url, { headers: feed.headers });
      const parsed = parseFeed(raw);
      const perFeedLimit = feed.limit ?? widgetLimit(cfg, RSS_DEFAULTS.limit);
      const slice = parsed.items.slice(0, perFeedLimit);
      return slice.map((item) => ({
        title: itemTitle(item),
        url: itemLink(item),
        published: itemPublished(item),
        source: feed.title ?? parsed.title ?? '',
        thumbnail: extractThumbnail(item),
        description: feed['hide-description'] ? null : itemDescription(item),
        categories: feed['hide-categories'] ? [] : extractCategories(item),
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
  const limit = widgetLimit(cfg, RSS_DEFAULTS.limit);
  return { items: items.slice(0, limit) };
});
