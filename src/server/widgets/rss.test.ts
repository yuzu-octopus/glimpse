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
    // The one healthy feed contributes exactly its items, newest first.
    // `toBeGreaterThan(0)` would pass even if a single failing feed poisoned
    // the batch and only one item survived.
    expect(data.items).toHaveLength(2);
    expect(data.items.map((i) => i.title)).toEqual(['Second post', 'First post']);
  });

  it('throws when every feed fails', async () => {
    // The message is the contract: a bare toThrow would equally pass on a
    // config error or a schema rejection.
    const ctx = makeCtx(async () => new Response('nope', { status: 500 }));
    await expect(
      rssFetcher()(ctx, { type: 'rss', feeds: [{ url: 'https://example.com/x' }] }),
    ).rejects.toThrow('all RSS feeds failed to load');
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

  it('prepends item-link-prefix to a feed that emits bare paths', async () => {
    // The escape hatch exists for feeds whose <link> is a path, not a URL.
    const relative = `<?xml version="1.0"?><rss version="2.0"><channel>
      <title>Bare</title>
      <item><title>One</title><link>posts/1</link></item>
      <item><title>Two</title><link>posts/2</link></item>
    </channel></rss>`;
    const ctx = makeCtx(async (url) => new Response(url.includes('bare') ? relative : RSS_FIXTURE, { status: 200 }));
    const data = (await rssFetcher()(ctx, {
      type: 'rss',
      feeds: [
        { url: 'https://bare.example/feed', 'item-link-prefix': 'https://proxy.example/' },
        { url: 'https://other.example/feed' },
      ],
    })) as { items: RssItem[] };
    const urls = data.items.map((i) => i.url).sort();
    expect(urls).toEqual([
      'https://example.com/1',
      'https://example.com/2',
      'https://proxy.example/posts/1',
      'https://proxy.example/posts/2',
    ]);
  });

});
