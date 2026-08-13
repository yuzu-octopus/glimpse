import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './rss';
import type { RssItem } from '../../shared/widgets/payloads';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Test Feed</title>
  <item>
    <title>First post</title>
    <link>https://example.com/1</link>
    <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
    <description>First description</description>
    <category>News</category>
    <category>Tech</category>
  </item>
  <item>
    <title>Second post</title>
    <link>https://example.com/2</link>
    <pubDate>Mon, 02 Jan 2024 10:00:00 GMT</pubDate>
    <media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="https://example.com/thumb.jpg"/>
  </item>
</channel></rss>`;

function makeCtx(fetchImpl: (url: string) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const rssFetcher = () => serverWidgets.get('rss')!;


describe('rss fetcher', () => {
  it('parses RSS items with source, date and thumbnail', async () => {
    const ctx = makeCtx(async () => new Response(RSS_FIXTURE, { status: 200 }));
    const data = (await rssFetcher()(ctx, { type: 'rss', feeds: [{ url: 'https://example.com/feed' }] })) as { items: RssItem[] };
    expect(data.items).toHaveLength(2);
    // sorted newest first
    expect(data.items[0].title).toBe('Second post');
    expect(data.items[0].thumbnail).toBe('https://example.com/thumb.jpg');
    expect(data.items[1].description).toBe('First description');
    expect(data.items[1].source).toBe('Test Feed');
  });

  it('applies the global limit', async () => {
    const ctx = makeCtx(async () => new Response(RSS_FIXTURE, { status: 200 }));
    const data = (await rssFetcher()(ctx, { type: 'rss', feeds: [{ url: 'x' }], limit: 1 })) as { items: RssItem[] };
    expect(data.items).toHaveLength(1);
  });

  it('succeeds with partial feed failures', async () => {
    const ctx = makeCtx(async (url) =>
      url.includes('broken') ? new Response('nope', { status: 500 }) : new Response(RSS_FIXTURE, { status: 200 }),
    );
    const data = (await rssFetcher()(ctx, {
      type: 'rss',
      feeds: [{ url: 'https://example.com/ok' }, { url: 'https://example.com/broken' }],
    })) as { items: RssItem[] };
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('throws when every feed fails', async () => {
    const ctx = makeCtx(async () => new Response('nope', { status: 500 }));
    await expect(
      rssFetcher()(ctx, { type: 'rss', feeds: [{ url: 'https://example.com/x' }] }),
    ).rejects.toThrow();
  });

  it('extracts categories per item', async () => {
    const ctx = makeCtx(async () => new Response(RSS_FIXTURE, { status: 200 }));
    const data = (await rssFetcher()(ctx, { type: 'rss', feeds: [{ url: 'https://example.com/feed' }] })) as { items: RssItem[] };
    // sorted newest first: 'Second post' has no categories, 'First post' has two
    expect(data.items[0].categories).toEqual([]);
    expect(data.items[1].categories).toEqual(['News', 'Tech']);
  });

  it('hides categories and description per feed', async () => {
    const ctx = makeCtx(async () => new Response(RSS_FIXTURE, { status: 200 }));
    const data = (await rssFetcher()(ctx, {
      type: 'rss',
      feeds: [{ url: 'https://example.com/feed', 'hide-categories': true, 'hide-description': true }],
    })) as { items: RssItem[] };
    expect(data.items[1].categories).toEqual([]);
    expect(data.items[1].description).toBeNull();
  });
});
