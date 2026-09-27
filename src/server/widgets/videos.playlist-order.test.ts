import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import { parsePlaylistBrowse } from './videos';
import './videos';
import type { Video } from '../../shared/widgets/payloads';

/**
 * The playlist feed is a POSITIONAL window of the first 15 slots in playlist
 * order — not the 15 most recent — so an owner-ordered oldest-first playlist
 * ("all episodes", a curriculum, an archive) makes the widget show its OLDEST
 * videos forever. The research proved it three independent ways
 * (`docs/research/youtube-fetching-2026/REPORT.md` §Playlists, findings/F5 §A2).
 *
 * The two fixtures below are CAPTURES, not mocks of a guess: taken from live
 * YouTube on 2026-09-27 with the ids, order and dates YouTube actually served.
 * The test suite itself never touches the network.
 *
 * - `PL0vfts4VzfNigohKr5sPrkcPFpuZmTe2C` ("Shorts", 48 videos, appended
 *   oldest-first): `feeds/videos.xml?playlist_id=` answered 200 with **14**
 *   entries whose `<published>` climbs 2021-03-20 → 2021-06-29 — the oldest
 *   videos — and those 14 ids are playlist positions 1-14. The `browse`
 *   listing answered 200 with all 48 in playlist order, and its tail carried
 *   "2 years ago" against the head's "5 years ago", so the end of that
 *   playlist really is its newer end.
 * - `PL0vfts4VzfNhyuLwMtD1_f1hSWo6V_kIY` ("OpenAi", 28 videos, newest-first):
 *   the same feed answered 15 entries with `<published>` falling
 *   2026-07-17 → 2025-03-28 — genuinely the newest — so this is the shape
 *   that must keep working untouched.
 */
const OLDEST_FIRST = 'PL0vfts4VzfNigohKr5sPrkcPFpuZmTe2C';
const NEWEST_FIRST = 'PL0vfts4VzfNhyuLwMtD1_f1hSWo6V_kIY';

const BROWSE = 'https://www.youtube.com/youtubei/v1/browse';

/** One `lockupViewModel` as the playlist payload actually ships it today:
 * F5 measured 49 of these on a 48-video playlist and 0 `playlistVideoRenderer`. */
const lockup = (id: string, title: string, ago: string) => ({
  lockupViewModel: {
    contentId: id,
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    contentImage: { thumbnailViewModel: { image: { sources: [{ url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }] } } },
    metadata: {
      lockupMetadataViewModel: {
        title: { content: title },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [
              { metadataParts: [{ text: { content: 'Fireship' } }] },
              { metadataParts: [{ text: { content: '1.7M views' } }, { text: { content: ago } }] },
            ],
            delimiter: ' • ',
          },
        },
      },
    },
  },
});

/** A playlist lockup shares the key but carries a 34-char id; it is not a video. */
const playlistLockup = { lockupViewModel: { contentId: 'PL0vfts4VzfNigohKr5sPrkcPFpuZmTe2C', contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' } };

const browseBody = (nodes: unknown[], continuation?: string) => ({
  response: { contents: nodes, ...(continuation ? { continuationItems: [{ continuationItemRenderer: { continuationCommand: { token: continuation } } }] } : {}) },
});

const feedEntry = (id: string, title: string, published: string) =>
  `<entry>
    <title>${title}</title>
    <link href="https://www.youtube.com/watch?v=${id}"/>
    <published>${published}</published>
    <media:group><media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg"/></media:group>
  </entry>`;

const feed = (title: string, entries: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>${title}</title>
  ${entries.join('\n')}
</feed>`;

/** The captured oldest-first window: dates climb, ids are playlist slots 1-14. */
const OLDEST_FIRST_FEED = feed(
  'Shorts',
  [
    ['pL7h1tUzrBs', '7 Linux Things You Say WRONG #Shorts', '2021-03-20T15:27:42+00:00'],
    ['WpgZKBtW_t8', 'VS Code Path Trick w/ JavaScript #Shorts', '2021-03-21T15:44:47+00:00'],
    ['nvlizC6koSc', '4 Steps to Become a Developer #Shorts', '2021-03-23T15:54:48+00:00'],
  ].map(([id, title, at]) => feedEntry(id, title, at)),
);

/** The captured newest-first window: dates fall, so this is really the newest. */
const NEWEST_FIRST_FEED = feed(
  'OpenAi',
  [
    ['5D4Zqp9GLSc', 'OpenAI gets sued for stealing, again…', '2026-07-17T17:56:42+00:00'],
    ['CXSvKcLovAk', 'The most controversial rewrite in history just shipped…', '2026-07-15T17:39:02+00:00'],
    ['URKml8lgw8Y', 'OpenAI is so back… GPT 5.6 Sol first look', '2026-07-10T17:25:44+00:00'],
  ].map(([id, title, at]) => feedEntry(id, title, at)),
);

/** The listing's last three entries IN PLAYLIST ORDER — oldest first, so the
 * last of them is the playlist's newest. InnerTube marks these "2 years ago"
 * against the head's "5 years ago". */
const TAIL_IN_PLAYLIST_ORDER = [
  ['fwBIZRq-vzY', '5 life-changing Linux tips'],
  ['tUjjsqRp3mg', 'this is just sad... CrowdStrike attacks a clown website'],
  ['ZRjmGq1gAEQ', 'Let’s play… Does your code suck? JavaScript Variables Edition'],
];

/** What a correct widget shows for that playlist: the end of the listing,
 * newest first. */
const NEWEST_END = TAIL_IN_PLAYLIST_ORDER.map(([id]) => id).reverse();

type Payload = { videos: Video[]; issues: { source: string; reason: string }[] };

function makeCtx(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  cache = new TtlCache(),
): WidgetFetchContext {
  return {
    fetch: vi.fn(handler) as unknown as typeof fetch,
    env: {},
    cache,
    singleflight: new Singleflight(),
  };
}

const videosFetcher = () => serverWidgets.get('videos')!;

/** The ids the widget showed, newest first — the only thing that matters here. */
const shown = (data: Payload) => data.videos.map((v) => v.url.split('v=')[1]);

describe('playlist order: the feed window is a positional window, not the newest', () => {
  // The bug: slots 1-14 of a 48-video oldest-first playlist. Showing those
  // means the widget never moves again. The tail is what "latest" means.
  it('shows the newest end of an oldest-first playlist, not the window the feed gave', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      // A 48-video playlist: the head is the five years ago block, the tail
      // the two years ago block that follows it in playlist order.
      const listing = [
        lockup('pL7h1tUzrBs', '7 Linux Things You Say WRONG #Shorts', '5 years ago'),
        lockup('WpgZKBtW_t8', 'VS Code Path Trick w/ JavaScript #Shorts', '5 years ago'),
        lockup('nvlizC6koSc', '4 Steps to Become a Developer #Shorts', '5 years ago'),
        ...TAIL_IN_PLAYLIST_ORDER.map(([id, title]) => lockup(id, title, '2 years ago')),
        playlistLockup,
      ];
      return new Response(JSON.stringify(browseBody(listing)), { status: 200 });
    });

    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      playlists: [OLDEST_FIRST],
      limit: 3,
      'video-url-template': 'https://invidious.local/watch?v={VIDEO-ID}',
    })) as Payload;

    expect(shown(data)).toEqual(NEWEST_END);
    // and it says so, rather than passing a reordering off as the feed
    expect(data.issues).toEqual([{ source: OLDEST_FIRST, reason: 'oldest-first playlist: newest 3 of 6' }]);
    // the video-url-template still applies to a corrected row
    expect(data.videos[0].url).toBe(`https://invidious.local/watch?v=${NEWEST_END[0]}`);
    expect(seen.filter((r) => r.startsWith('POST'))).toEqual([`POST ${BROWSE}`]);
  });

  // A newest-first playlist is the common case and costs nothing: the feed
  // already is the newest, so no listing request is made and no issue appears.
  it('leaves a newest-first playlist on the feed alone', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/feeds/videos.xml')) return new Response(NEWEST_FIRST_FEED, { status: 200 });
      return new Response('{}', { status: 200 });
    });

    const data = (await videosFetcher()(ctx, { type: 'videos', playlists: [NEWEST_FIRST] })) as Payload;

    expect(seen).toEqual([`GET https://www.youtube.com/feeds/videos.xml?playlist_id=${NEWEST_FIRST}`]);
    expect(shown(data)).toEqual(['5D4Zqp9GLSc', 'CXSvKcLovAk', 'URKml8lgw8Y']);
    expect(data.videos[0].published).toBe('2026-07-17T17:56:42+00:00');
    expect(data.issues).toEqual([]);
  });

  // Fifteen videos published in the same second is the shape a busy channel
  // produces. Ascending order means nothing without a step, so nothing is
  // reordered — a tie-heavy newest-first feed can never be "corrected".
  it('does not reorder a window whose dates are all the same', async () => {
    const sameDay = feed('Bump', [feedEntry('aaaaaaaaaaa', 'One', '2026-01-01T00:00:00+00:00'), feedEntry('bbbbbbbbbbb', 'Two', '2026-01-01T00:00:00+00:00')]);
    const seen: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/feeds/videos.xml')) return new Response(sameDay, { status: 200 });
      return new Response('{}', { status: 200 });
    });

    const data = (await videosFetcher()(ctx, { type: 'videos', playlists: ['PLties'] })) as Payload;

    expect(seen.filter((r) => r.startsWith('POST'))).toEqual([]);
    expect(shown(data)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(data.issues).toEqual([]);
  });

  // A playlist the feed listed in full was never stale: its order is the
  // owner's order and there is nothing to correct, so nothing is said.
  it('keeps the feed when the listing shows it held the whole playlist', async () => {
    const ctx = makeCtx(async (url) => {
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      const listing = ['pL7h1tUzrBs', 'WpgZKBtW_t8', 'nvlizC6koSc'].map((id) => lockup(id, `V ${id}`, '5 years ago'));
      return new Response(JSON.stringify(browseBody(listing)), { status: 200 });
    });

    const data = (await videosFetcher()(ctx, { type: 'videos', playlists: [OLDEST_FIRST], limit: 2 })) as Payload;

    // the window, dated newest-first by the widget's own sort, untouched
    expect(shown(data)).toEqual(['nvlizC6koSc', 'WpgZKBtW_t8']);
    expect(data.videos[0].published).toBe('2021-03-23T15:54:48+00:00');
    expect(data.issues).toEqual([]);
  });

  // A 300+ episode archive needs a second page to reach its end; the tail
  // has to come from the page that actually holds it.
  it('follows a continuation token to find the end of a long playlist', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      const body = init?.body as string | undefined;
      if (body && body.includes('continuation')) {
        return new Response(JSON.stringify(browseBody([lockup('zzzzzzzzzzz', 'The actual newest', '1 day ago')])), { status: 200 });
      }
      return new Response(
        JSON.stringify(
          browseBody(
            [lockup('pL7h1tUzrBs', 'Oldest', '5 years ago'), lockup('WpgZKBtW_t8', 'Next oldest', '5 years ago'), lockup('nvlizC6koSc', 'Third', '5 years ago')],
            'TOKEN-1',
          ),
        ),
        { status: 200 },
      );
    });

    const data = (await videosFetcher()(ctx, { type: 'videos', playlists: [OLDEST_FIRST], limit: 2 })) as Payload;

    expect(seen.filter((r) => r.startsWith('POST'))).toHaveLength(2);
    expect(shown(data)).toEqual(['zzzzzzzzzzz', 'nvlizC6koSc']);
    expect(data.issues[0].reason).toContain('oldest-first playlist');
  });

  // The one state that must never exist: a fresh window we know is the oldest
  // videos, rendered as if it were current. A dead listing is named instead.
  it('never serves a known-stale window when the playlist cannot be listed', async () => {
    const cache = new TtlCache();
    const ok = makeCtx(async (url) => {
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      const listing = [
        lockup('pL7h1tUzrBs', 'Oldest one', '5 years ago'),
        lockup('WpgZKBtW_t8', 'Oldest two', '5 years ago'),
        ...TAIL_IN_PLAYLIST_ORDER.map(([id, title]) => lockup(id, title, '2 years ago')),
      ];
      return new Response(JSON.stringify(browseBody(listing)), { status: 200 });
    }, cache);
    const first = (await videosFetcher()(ok, { type: 'videos', playlists: [OLDEST_FIRST], limit: 2 })) as Payload;
    expect(shown(first)).toEqual(NEWEST_END.slice(0, 2));

    const dead = makeCtx(async (url) => {
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      return new Response('nope', { status: 500 });
    }, cache);
    const second = (await videosFetcher()(dead, { type: 'videos', playlists: [OLDEST_FIRST], limit: 2 })) as Payload;

    expect(shown(second)).toEqual(NEWEST_END.slice(0, 2));
    expect(second.issues).toEqual([
      { source: OLDEST_FIRST, reason: 'oldest-first playlist could not be listed: HTTP 500' },
    ]);
  });

  it('reports an unreadable listing rather than an empty playlist', async () => {
    const ctx = makeCtx(async (url) => {
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      return new Response('<html>consent wall</html>', { status: 200 });
    });

    const data = (await videosFetcher()(ctx, { type: 'videos', playlists: [OLDEST_FIRST] })) as Payload;

    expect(data.videos).toEqual([]);
    expect(data.issues[0].reason).toContain('browse response was not JSON');
  });

  // `PL…` and `playlist:PL…` are one request, and the listing uses the bare id.
  it('keeps the playlist: prefix out of the listing request', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}${init?.body ? ' ' + init.body : ''}`);
      if (url.includes('/feeds/videos.xml')) return new Response(OLDEST_FIRST_FEED, { status: 200 });
      const listing = [
        lockup('pL7h1tUzrBs', 'Oldest one', '5 years ago'),
        ...TAIL_IN_PLAYLIST_ORDER.map(([id, title]) => lockup(id, title, '2 years ago')),
      ];
      return new Response(JSON.stringify(browseBody(listing)), { status: 200 });
    });

    await videosFetcher()(ctx, { type: 'videos', playlists: [`playlist:${OLDEST_FIRST}`], limit: 1 });

    expect(seen[0]).toBe(`GET https://www.youtube.com/feeds/videos.xml?playlist_id=${OLDEST_FIRST}`);
    expect(seen[1]).toContain(`"browseId":"VL${OLDEST_FIRST}"`);
  });
});

describe('parsePlaylistBrowse', () => {
  it('reads the ordered lockups and hands back the continuation token', () => {
    const raw = JSON.stringify(
      browseBody([lockup('aaaaaaaaaaa', 'First', '5 years ago'), playlistLockup, lockup('bbbbbbbbbbb', 'Second', '2 years ago')], 'TOKEN-1'),
    );
    const { entries, continuation } = parsePlaylistBrowse(raw);
    expect(entries).toEqual([
      { videoId: 'aaaaaaaaaaa', title: 'First' },
      { videoId: 'bbbbbbbbbbb', title: 'Second' },
    ]);
    expect(continuation).toBe('TOKEN-1');
  });

  it('drops a lockup with no title instead of printing its id', () => {
    const raw = JSON.stringify(browseBody([{ lockupViewModel: { contentId: 'aaaaaaaaaaa', metadata: { lockupMetadataViewModel: { title: {} } } } }]));
    expect(parsePlaylistBrowse(raw).entries).toEqual([]);
  });

  it('throws on a body that is not JSON', () => {
    expect(() => parsePlaylistBrowse('<html>consent wall</html>')).toThrow(/not JSON/);
  });
});
