import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './videos';
import { extractCanonicalChannelId, extractChannelId } from './videos';
import type { Video } from '../../shared/widgets/payloads';

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const videosFetcher = () => serverWidgets.get('videos')!;

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Mock Channel</title>
  <entry><title>V1</title><link href="https://www.youtube.com/watch?v=aaa"/><published>2024-01-02T10:00:00+00:00</published></entry>
</feed>`;

const RESOLVE_ENDPOINT =
  'https://www.youtube.com/youtubei/v1/navigation/resolve_url?prettyPrint=false';
const RESOLVE_PATH = '/navigation/resolve_url';

/** A resolve_url 200 in the shape the live probe returned
 * (REPORT.md finding 3): the id is at response.endpoint.browseEndpoint.browseId. */
const resolveResponse = (browseId: string): Response =>
  new Response(JSON.stringify({ response: { endpoint: { browseEndpoint: { browseId } } } }), {
    status: 200,
  });

describe('Task 3: YouTube @handle primary', () => {
  it('@spokeishere resolves to UCk2ux (case-insensitive)', async () => {
    let resolveCalls = 0;
    const asked: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      if (url.includes(RESOLVE_PATH)) {
        resolveCalls++;
        // The configured spelling is what goes to YouTube — only the cache
        // key lowercases it.
        asked.push(JSON.parse(String(init?.body)).url);
        return resolveResponse('UCk2uxbWi5py_iJXaEsh2YRA');
      }
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCk2uxbWi5py_iJXaEsh2YRA');
      return new Response(FEED, { status: 200 });
    });
    const data1 = (await videosFetcher()(ctx, { type: 'videos', channels: ['@SpokeIsHere'] })) as { videos: Video[] };
    const data2 = (await videosFetcher()(ctx, { type: 'videos', channels: ['@spokeishere'] })) as { videos: Video[] };
    expect(data1.videos).toHaveLength(1);
    expect(data2.videos).toHaveLength(1);
    expect(asked).toEqual(['https://www.youtube.com/@SpokeIsHere']);
    // One resolve for two spellings: the cache key lowercases.
    expect(resolveCalls).toBe(1);
  });

  it('@Bug-I with hyphen resolves without losing the hyphen', async () => {
    const ctx = makeCtx(async (url, init) => {
      if (url.includes(RESOLVE_PATH)) {
        expect(JSON.parse(String(init?.body)).url).toBe('https://www.youtube.com/@Bug-I');
        return resolveResponse('UCeUHo1UGx4p97AQllOYuneA');
      }
      expect(url).toContain('channel_id=UCeUHo1UGx4p97AQllOYuneA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Bug-I'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
  });

  it('bare handle without @ also resolves (e.g. spokeishere)', async () => {
    const ctx = makeCtx(async (url, init) => {
      if (url.includes(RESOLVE_PATH)) {
        // Named the way YouTube spells it, so the resolve hop gets a handle.
        expect(JSON.parse(String(init?.body)).url).toBe('https://www.youtube.com/@spokeishere');
        return resolveResponse('UCk2uxbWi5py_iJXaEsh2YRA');
      }
      expect(url).toContain('UCk2uxbWi5py_iJXaEsh2YRA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['spokeishere'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
  });

  it('UC fallback still works (no handle resolve)', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['UCsBjURrPoezykLs9EqgamOA'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
    expect(seen.some((u) => u.includes(RESOLVE_PATH))).toBe(false);
  });

  it('sends a Mozilla User-Agent on the resolve, handle and feed fetches', async () => {
    const uas: string[] = [];
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(async (url: string, init?: RequestInit) => {
        const h = (init?.headers as Record<string, string> | undefined) ?? {};
        if (h['User-Agent']) uas.push(h['User-Agent']);
        if (url.includes(RESOLVE_PATH)) return resolveResponse('UC1234567890123456789012');
        if (url.includes('youtube.com/@')) {
          return new Response(`{"externalId":"UC1234567890123456789012"}`, { status: 200 });
        }
        return new Response(FEED, { status: 200 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    await videosFetcher()(ctx, { type: 'videos', channels: ['@TestHandle'] });
    expect(uas.length).toBeGreaterThanOrEqual(2);
    for (const ua of uas) expect(ua).toMatch(/Mozilla\/5\.0/);
  });

  it('extractChannelId handles all patterns', () => {
    expect(extractChannelId(`"externalId":"UC1234567890123456789012"`)).toBe('UC1234567890123456789012');
    expect(extractChannelId(`"browseId":"UC1234567890123456789012"`)).toBe('UC1234567890123456789012');
    expect(extractChannelId(`"channelId":"UC1234567890123456789012"`)).toBe('UC1234567890123456789012');
    expect(extractChannelId(`channel_id=UC1234567890123456789012`)).toBe('UC1234567890123456789012');
    expect(extractChannelId('no id here')).toBeNull();
  });

  // `catch { id = ch }` used to fall through to `channel_id=@typo`, a URL that
  // cannot answer, so a misspelt handle cost a second doomed request and said
  // nothing. Nothing doomed is requested now: resolve_url 404s, that is the
  // only unambiguous bad-config signal we have, and the handle page could only
  // have 404'd too.
  it('a handle resolve_url 404s on is reported by name, in one request', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      return new Response(
        JSON.stringify({ error: { message: 'Requested entity was not found.' } }),
        { status: 404 },
      );
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@typo'] })) as {
      videos: Video[];
      issues: { source: string; reason: string }[];
    };

    expect(seen).toEqual([RESOLVE_ENDPOINT]);
    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([{ source: '@typo', reason: 'handle not found: @typo' }]);
  });

  it('a bare handle without @ is reported the way YouTube spells it', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      return new Response('not found', { status: 404 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['typo'] })) as {
      issues: { source: string; reason: string }[];
    };

    expect(seen).toEqual([RESOLVE_ENDPOINT]);
    expect(data.issues).toEqual([{ source: '@typo', reason: 'handle not found: @typo' }]);
  });

  it('a handle page that answers without a channel id is a resolution failure', async () => {
    const ctx = makeCtx(async (url) => {
      // The resolve is refused the way YouTube refuses a changed request
      // contract, so the page scrape is what gets the last word.
      if (url.includes(RESOLVE_PATH)) {
        return new Response(JSON.stringify({ error: { message: 'invalid argument' } }), {
          status: 400,
        });
      }
      return url.includes('youtube.com/@')
        ? new Response('<html><body>consent wall</body></html>', { status: 200 })
        : new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Wall'] })) as {
      videos: Video[];
      issues: { source: string; reason: string }[];
    };

    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([
      { source: '@Wall', reason: 'could not resolve @Wall: the page carried no channel id' },
    ]);
  });

  it('a value starting with UC is a channel id, never sent to the handle resolver', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['UC1'] })) as {
      videos: Video[];
      issues: unknown[];
    };

    expect(seen.some((u) => u.includes(RESOLVE_PATH) || u.includes('youtube.com/@'))).toBe(false);
    expect(data.videos).toHaveLength(1);
    expect(data.issues).toEqual([]);
  });

  it('config.example.yml uses @handle primary with @spokeishere, @Bug-I etc', () => {
    const yml = readFileSync('config.example.yml', 'utf8');
    expect(yml).toContain('@Fireship');
    expect(yml).toContain('@Bug-I');
    expect(yml).toContain('@CalebWritesCode');
    expect(yml).toContain('@AZisk');
    expect(yml).toContain('@SpokeIsHere');
    expect(yml.toLowerCase()).toContain('uc');
  });
});

/**
 * The resolve chain itself (REPORT.md findings 1, 3 and 4). Each of these is a
 * shape the endpoint actually returns, and each must end in either a real
 * channel id or a visible per-source failure.
 */
describe('videos: handle resolution chain', () => {
  const PAGE = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA">
</head><body>{"externalId":"UCsBjURrPoezykLs9EqgamOA"}</body></html>`;

  it('a failed resolve falls to the page scrape, which then answers normally', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      if (url.includes(RESOLVE_PATH)) return new Response('nope', { status: 400 });
      if (url.includes('youtube.com/@')) return new Response(PAGE, { status: 200 });
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Fireship'] })) as {
      videos: Video[];
      issues: unknown[];
    };

    expect(seen).toEqual([
      RESOLVE_ENDPOINT,
      'https://www.youtube.com/@Fireship',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
    ]);
    expect(data.videos).toHaveLength(1);
    expect(data.issues).toEqual([]);
  });

  // The report puts the id under `response.`, but every live probe from this
  // host on 2026-09-27 returned it at the top level, with the same ids its own
  // table lists. Read one shape only and the primary demotes itself to the
  // scrape on every single handle.
  it('reads the browseId from the top-level endpoint too', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      if (url.includes(RESOLVE_PATH)) {
        return new Response(
          JSON.stringify({ endpoint: { browseEndpoint: { browseId: 'UCsBjURrPoezykLs9EqgamOA' } } }),
          { status: 200 },
        );
      }
      if (url.includes('youtube.com/@')) return new Response(PAGE, { status: 200 });
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Fireship'] })) as {
      videos: Video[];
    };

    expect(seen).toEqual([
      RESOLVE_ENDPOINT,
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
    ]);
    expect(data.videos).toHaveLength(1);
  });

  it('the rescue costs one look even when retries are configured', async () => {
    let pageLooked = 0;
    const ctx = makeCtx(async (url) => {
      if (url.includes(RESOLVE_PATH)) return new Response('nope', { status: 400 });
      if (url.includes('youtube.com/@')) {
        pageLooked++;
        return new Response(PAGE, { status: 200 });
      }
      return new Response(FEED, { status: 200 });
    });
    await videosFetcher()(ctx, { type: 'videos', channels: ['@Fireship'], retries: 2 });

    // The resolve spends the configured budget; the rescue that follows must
    // not start a second ladder for the same source.
    expect(pageLooked).toBe(1);
  });

  // The research's "assert, do not default" row: a 200 with no browseId is
  // unresolved. Defaulting it to '' would ask for `channel_id=`, a 404 we
  // manufactured ourselves and then blamed on YouTube.
  it('a 200 with no browseId never becomes an empty channel_id', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      if (url.includes(RESOLVE_PATH)) {
        return new Response(JSON.stringify({ response: { endpoint: {} } }), { status: 200 });
      }
      return new Response('gone', { status: 404 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Ghost'] })) as {
      videos: Video[];
      issues: { source: string; reason: string }[];
    };

    // No `videos.xml?channel_id=` request at all: the alternative is
    // `channel_id=` with an empty id, a 404 we invented.
    expect(seen.some((u) => u.includes('videos.xml'))).toBe(false);
    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([{ source: '@Ghost', reason: 'handle not found: @Ghost' }]);
  });

  it('a browseId that is not a channel id is a failure, not a feed url', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      // A playlist browseId: `VLPL…` comes back from resolve_url for playlist
      // URLs, and a playlist id in channel_id= is a URL that cannot answer.
      if (url.includes(RESOLVE_PATH)) {
        return new Response(
          JSON.stringify({
            response: { endpoint: { browseEndpoint: { browseId: 'VLPL0vfts4VzfNjnYhJMfTulea5McZbQLM7G' } } },
          }),
          { status: 200 },
        );
      }
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Playlistish'] })) as {
      videos: Video[];
      issues: { source: string; reason: string }[];
    };

    expect(seen.some((u) => u.includes('videos.xml'))).toBe(false);
    expect(data.issues).toEqual([
      { source: '@Playlistish', reason: 'could not resolve @Playlistish: the page carried no channel id' },
    ]);
  });

  it('a scraped id the page canonical contradicts is rejected, not used', async () => {
    const seen: string[] = [];
    // The real page carries 17 distinct UC… strings; if `externalId` ever goes
    // away the extractor lands on another channel entirely, and that channel's
    // feed answers 200 with 15 plausible wrong videos.
    const crossed = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA">
</head><body>{"browseId":"UCt5Z3JhbmdlZHRlc3QxMjM0"}</body></html>`;
    const ctx = makeCtx(async (url) => {
      seen.push(url);
      if (url.includes(RESOLVE_PATH)) return new Response('nope', { status: 400 });
      if (url.includes('youtube.com/@')) return new Response(crossed, { status: 200 });
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Fireship'] })) as {
      videos: Video[];
      issues: { source: string; reason: string }[];
    };

    expect(seen.some((u) => u.includes('videos.xml'))).toBe(false);
    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([
      { source: '@Fireship', reason: 'could not resolve @Fireship: the page canonical names another channel' },
    ]);
  });

  it('extractCanonicalChannelId reads the link tag, og:url, or neither', () => {
    expect(
      extractCanonicalChannelId(
        '<link rel="canonical" href="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA">',
      ),
    ).toBe('UCsBjURrPoezykLs9EqgamOA');
    // Attribute order must not matter.
    expect(
      extractCanonicalChannelId(
        '<link href="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA" rel="canonical">',
      ),
    ).toBe('UCsBjURrPoezykLs9EqgamOA');
    expect(
      extractCanonicalChannelId(
        '<meta property="og:url" content="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA">',
      ),
    ).toBe('UCsBjURrPoezykLs9EqgamOA');
    // A handle page may canonicalise to its own /@handle form: no id stated is
    // not a disagreement, so it must not reject anything.
    expect(extractCanonicalChannelId('<link rel="canonical" href="https://www.youtube.com/@Fireship">')).toBeNull();
    expect(extractCanonicalChannelId('<html><body>{"externalId":"UC1"}</body></html>')).toBeNull();
  });
});
