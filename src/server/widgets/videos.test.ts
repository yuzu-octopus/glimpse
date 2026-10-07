import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './videos';
import type { Video, VideosData } from '../../shared/widgets/payloads';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>My Channel</title>
  <entry>
    <title>Video one</title>
    <link href="https://www.youtube.com/watch?v=aaa"/>
    <published>2024-01-02T10:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/aaa/hqdefault.jpg"/>
    </media:group>
  </entry>
  <entry>
    <title>Video two</title>
    <link href="https://www.youtube.com/watch?v=bbb"/>
    <published>2024-01-01T10:00:00+00:00</published>
  </entry>
</feed>`;

function makeCtx(fetchImpl: (url: string) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const videosFetcher = () => serverWidgets.get('videos')!;

describe('videos fetcher', () => {
  it('maps entries with thumbnail and sorts newest first', async () => {
    const ctx = makeCtx(async () => new Response(FEED, { status: 200 }));
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
    })) as { videos: Video[] };
    expect(data.videos).toHaveLength(2);
    expect(data.videos[0].title).toBe('Video one');
    expect(data.videos[0].thumbnail).toBe('https://i.ytimg.com/vi/aaa/hqdefault.jpg');
    expect(data.videos[0].channel).toBe('My Channel');
    expect(data.videos[1].thumbnail).toBeNull();
  });


  it('fetches playlist feeds and applies the limit', async () => {
    const ctx = makeCtx(async (url) => {
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      playlists: ['PLabc'],
      limit: 1,
    })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
  });


  it('drops shorts unless include-shorts is set', async () => {
    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>My Channel</title>
  <entry>
    <title>Long video</title>
    <link href="https://www.youtube.com/watch?v=aaa"/>
    <published>2024-01-02T10:00:00+00:00</published>
  </entry>
  <entry>
    <title>Short clip</title>
    <link href="https://www.youtube.com/shorts/bbb"/>
    <published>2024-01-01T10:00:00+00:00</published>
  </entry>
</feed>`;
    const ctx = makeCtx(async () => new Response(feed, { status: 200 }));

    const filtered = (await videosFetcher()(ctx, { type: 'videos', channels: ['UC1'] })) as { videos: Video[] };
    expect(filtered.videos).toHaveLength(1);
    expect(filtered.videos[0].title).toBe('Long video');

    const kept = (await videosFetcher()(ctx, { type: 'videos', channels: ['UC1'], 'include-shorts': true })) as {
      videos: Video[];
    };
    expect(kept.videos).toHaveLength(2);
  });

  it('applies the video-url-template with the extracted VIDEO-ID', async () => {
    const ctx = makeCtx(async () => new Response(FEED, { status: 200 }));
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
      'video-url-template': 'https://invidious.local/watch?v={VIDEO-ID}',
    })) as { videos: Video[] };
    expect(data.videos[0].url).toBe('https://invidious.local/watch?v=aaa');
    expect(data.videos[1].url).toBe('https://invidious.local/watch?v=bbb');
  });

  // The catch does not branch on status: a retryable status raises out of
  // fetchWithRetry, the channel-page rescue fails too, and the stale copy
  // serves. 429 and 500 are the same path, so they are one test.
  it.each([429, 500])('HTTP %i returns cached stale', async (status) => {
    const cachedVideos = [
      { title: 'cached', url: 'https://www.youtube.com/watch?v=cached', channel: 'Cached', published: null, thumbnail: null },
    ] as Video[];
    // retries: 0 — the fallback also hits the channel page, so a retryable
    // status twice over is backoff, not coverage.
    const ctx = makeCtx(async (url) =>
      url.includes('feeds/videos.xml') ? new Response('', { status }) : new Response('', { status: 404 }),
    );
    ctx.cache.set('videos:feed:UCx', cachedVideos, 3600_000);
    ctx.cache.set('videos:feed:UCx::::noshorts', cachedVideos, 3600_000);
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UCx'],
      retries: 0,
    })) as { videos: Video[] };
    expect(data.videos[0].title).toBe('cached');
  });
  it('sends Mozilla User-Agent on youtube fetches', async () => {
    let ua: string | null = null;
    const trackingCtx: WidgetFetchContext = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const h = (init?.headers as Record<string, string> | undefined) ?? {};
        ua = h['User-Agent'] ?? null;
        return new Response(FEED, { status: 200 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    await videosFetcher()(trackingCtx, { type: 'videos', channels: ['UC1234567890123456789012'] });
    expect(ua).toMatch(/Mozilla\/5\.0/);
  });

  // A source that fails used to contribute zero videos and leave the widget
  // looking merely quiet — the failure had nowhere to go. The payload now
  // names the source and the reason, and a healthy source stays silent.
  it('reports a dead source by name and reason instead of vanishing', async () => {
    const ctx = makeCtx(async (url) =>
      url.includes('channel_id=UCdead') ? new Response('', { status: 404 }) : new Response(FEED, { status: 200 }),
    );
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012', 'UCdead'],
    })) as VideosData;

    expect(data.videos).toHaveLength(2);
    expect(data.issues).toEqual([{ source: 'UCdead', reason: 'HTTP 404' }]);
  });

  it('says so when the feed is empty and the page has nothing either', async () => {
    const empty = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`;
    // The page answers with a real channel page whose grid holds no video: a
    // genuinely quiet channel, which is the one case that is not a broken
    // scraper and still has to be reported rather than shown as quiet.
    const quietChannel = `<!DOCTYPE html><html><body><script>var ytInitialData = {"contents":{}};</script></body></html>`;
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(async (url: string) =>
        url.includes('channel/UC1234567890123456789012/videos')
          ? new Response(quietChannel, { status: 200 })
          : new Response(empty, { status: 200 }),
      ) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };

    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
    })) as VideosData;

    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([{ source: 'UC1234567890123456789012', reason: 'no videos found' }]);
  });

  it('resolves playlist lockups when the page grid holds no videos', async () => {
    const empty = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`;
    // A channel page whose grid holds only playlist lockups — no video lockups.
    // This is the flamefrags case: the feed is correctly empty, the page has
    // content, but it is all playlists.
    const playlistPage = `<!DOCTYPE html><html><body><script>var ytInitialData = {"contents":[{"lockupViewModel":{"contentId":"PLabc123","metadata":{"lockupMetadataViewModel":{"title":{"content":"Playlist One"}}}}},{"lockupViewModel":{"contentId":"PLdef456","metadata":{"lockupMetadataViewModel":{"title":{"content":"Playlist Two"}}}}}]};</script></body></html>`;
    // InnerTube browse responses for the two playlists.
    const browseOne = JSON.stringify({
      contents: [
        { lockupViewModel: { contentId: 'vid000000001', metadata: { lockupMetadataViewModel: { title: { content: 'Video A' } } } } },
        { lockupViewModel: { contentId: 'vid000000002', metadata: { lockupMetadataViewModel: { title: { content: 'Video B' } } } } },
      ],
    });
    const browseTwo = JSON.stringify({
      contents: {
        lockupViewModel: { contentId: 'vid000000003', metadata: { lockupMetadataViewModel: { title: { content: 'Video C' } } } },
      },
    });
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('feeds/videos.xml')) return new Response(empty, { status: 200 });
        if (url.includes('/channel/UC1234567890123456789012/videos')) return new Response(playlistPage, { status: 200 });
        if (url.includes('youtubei/v1/browse')) {
          // Distinguish playlists by the browseId in the request body.
          const body = typeof init?.body === 'string' ? init.body : '';
          if (body.includes('PLabc123')) return new Response(browseOne, { status: 200 });
          if (body.includes('PLdef456')) return new Response(browseTwo, { status: 200 });
        }
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };

    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
    })) as VideosData;

    // Both playlists resolved, newest entries attributed to the channel.
    expect(data.videos).toHaveLength(3);
    expect(data.videos[0].title).toBe('Video A');
    expect(data.videos[0].channel).toBe('Empty');
    expect(data.videos[1].title).toBe('Video B');
    expect(data.videos[2].title).toBe('Video C');
    expect(data.issues).toEqual([]);
  });

  it('reports playlist listing failures when lockups cannot be resolved', async () => {
    const empty = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`;
    const playlistPage = `<!DOCTYPE html><html><body><script>var ytInitialData = {"contents":{"lockupViewModel":{"contentId":"PLabc123","metadata":{"lockupMetadataViewModel":{"title":{"content":"Playlist One"}}}}}};</script></body></html>`;
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(async (url: string) => {
        if (url.includes('feeds/videos.xml')) return new Response(empty, { status: 200 });
        if (url.includes('/channel/UC1234567890123456789012/videos')) return new Response(playlistPage, { status: 200 });
        if (url.includes('youtubei/v1/browse')) return new Response('', { status: 500 });
        return new Response('', { status: 404 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };

    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
    })) as VideosData;

    expect(data.videos).toEqual([]);
    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].source).toBe('UC1234567890123456789012');
    expect(data.issues[0].reason).toContain('playlist PLabc123 could not be listed');
  });

  // The rescue is a second look, not a second retry ladder: the feed has
  // already spent the configured budget, and a dead source should not cost
  // twice the backoff before the widget can fall back to cache.
  it('the page fallback gets one look, not a second retry budget', async () => {
    const hits: string[] = [];
    const ctx = makeCtx(async (url) => {
      hits.push(url);
      return new Response('', { status: 503 });
    });
    await videosFetcher()(ctx, { type: 'videos', channels: ['UC1234567890123456789012'], retries: 2 });

    const feed = hits.filter((u) => u.includes('feeds/videos.xml'));
    const page = hits.filter((u) => u.includes('/channel/UC1234567890123456789012/videos'));
    // retries: 2 → 1 initial attempt + 2 retries on the feed, once on the page
    expect(feed).toHaveLength(3);
    expect(page).toHaveLength(1);
  });

  it('a healthy source reports nothing at all', async () => {
    const ctx = makeCtx(async () => new Response(FEED, { status: 200 }));
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
      playlists: ['PLabc'],
    })) as VideosData;

    expect(data.videos).toHaveLength(2);
    expect(data.issues).toEqual([]);
  });

  it('one dot per problem, not per duplicate config line', async () => {
    const ctx = makeCtx(async () => new Response('', { status: 404 }));
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UCdead', 'UCdead'],
    })) as VideosData;

    expect(data.issues).toEqual([{ source: 'UCdead', reason: 'HTTP 404' }]);
  });

  it('resolves @handle to a channel id and fetches the feed', async () => {
    const ctx = makeCtx(async (url) => {
      if (url.includes('resolve_url')) {
        return new Response(
          JSON.stringify({ endpoint: { browseEndpoint: { browseId: 'UC1234567890123456789012' } } }),
          { status: 200 },
        );
      }
      if (url.includes('feeds/videos.xml')) return new Response(FEED, { status: 200 });
      return new Response('', { status: 404 });
    });
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['@ferntv'],
    })) as { videos: Video[] };
    expect(data.videos).toHaveLength(2);
    expect(data.videos[0].title).toBe('Video one');
  });

  it('reports handle not found honestly when resolution fails', async () => {
    const ctx = makeCtx(async (url) => {
      if (url.includes('resolve_url')) {
        return new Response(JSON.stringify({ error: { message: 'Requested entity was not found.' } }), { status: 404 });
      }
      return new Response('', { status: 404 });
    });
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['@ferntv'],
    })) as VideosData;
    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([{ source: '@ferntv', reason: 'handle not found: @ferntv' }]);
  });

  it('pools all sources newest-first and takes the limit', async () => {
    // 3 sources with skewed dates. Newest-first wins outright: the 6 newest
    // across all sources, regardless of channel.
    const makeFeed = (channel: string, count: number, startDay: number) => {
      const entries = Array.from({ length: count }, (_, i) => {
        const day = startDay - i;
        const id = `${channel.toLowerCase()}${String(i).padStart(2, '0')}`;
        return `<entry><title>${channel} Video ${i + 1}</title><link href="https://www.youtube.com/watch?v=${id}"/><published>2024-01-${String(day).padStart(2, '0')}T10:00:00+00:00</published></entry>`;
      }).join('');
      return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${channel}</title>${entries}</feed>`;
    };
    const ctx = makeCtx(async (url) => {
      if (url.includes('channel_id=UCaaa')) return new Response(makeFeed('Channel A', 5, 10), { status: 200 });
      if (url.includes('channel_id=UCbbb')) return new Response(makeFeed('Channel B', 3, 8), { status: 200 });
      if (url.includes('channel_id=UCccc')) return new Response(makeFeed('Channel C', 2, 6), { status: 200 });
      return new Response('', { status: 404 });
    });
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UCaaa', 'UCbbb', 'UCccc'],
      limit: 6,
    })) as VideosData;

    // The 6 newest overall: A1-A5 (days 10-6) + B1 (day 8)... in date order:
    // days 10,9,8,8,7,7 → A1,A2,B1,A3,B2,A4. B3/C rows are older, cut off.
    expect(data.videos).toHaveLength(6);
    const dates = data.videos.map((v) => v.published);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(data.videos[0].title).toBe('Channel A Video 1');
  });
});
