import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import { parseChannelPage } from './videos';
import './videos';
import type { Video } from '../../shared/widgets/payloads';

/**
 * A @handle whose RSS feed comes back empty (YouTube 404s `videos.xml` for many
 * small channels) falls back to the channel's own /videos page.
 *
 * Captured from https://www.youtube.com/@Fireship/videos: the grid ships as one
 * `ytInitialData` blob of `lockupViewModel` entries whose titles live at
 * `metadata.lockupMetadataViewModel.title.content`. Video ids still appear in
 * the page — but only inside `addToPlaylistCommand` menu blobs, never next to a
 * `title`, which is exactly what made the old
 * `"videoId":"X"[^}]*"title":{"runs":[{"text":"` regex fail and print the id.
 */
const lockup = (id: string, title: string | null) => ({
  richItemRenderer: {
    content: {
      lockupViewModel: {
        contentImage: {
          thumbnailViewModel: {
            image: {
              sources: [
                {
                  url: `https://i.ytimg.com/vi/${id}/hq720.jpg?sqp=-oaymwEcCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==`,
                  width: 360,
                  height: 202,
                },
              ],
            },
          },
        },
        metadata: {
          lockupMetadataViewModel: {
            title: title === null ? {} : { content: title },
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [
                  {
                    metadataParts: [
                      { text: { content: '1m' }, accessibilityLabel: '1 million views' },
                      { text: { content: '1 day ago' } },
                    ],
                  },
                ],
                delimiter: ' ',
              },
            },
            menuButton: {
              buttonViewModel: {
                iconName: 'MORE_VERT',
                onTap: {
                  innertubeCommand: {
                    addToPlaylistCommand: {
                      openMiniplayer: true,
                      videoId: id,
                      listType: 'PLAYLIST_EDIT_LIST_QUEUE',
                    },
                    createPlaylistServiceEndpoint: { videoIds: [id] },
                  },
                },
              },
            },
          },
        },
        contentId: id,
        contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
      },
    },
  },
});

const YT_INITIAL_DATA = {
  responseContext: {},
  contents: [
    {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              title: 'Videos',
              selected: true,
              content: {
                sectionListRenderer: {
                  contents: [
                    {
                      itemSectionRenderer: {
                        sectionIdentifier: 'recently-uploaded',
                        contents: [
                          {
                            richGridRenderer: {
                              contents: [
                                lockup(
                                  'c1rPlzxSZ8E',
                                  'Meta is pivoting again... everything you missed from Connect 2026',
                                ),
                                lockup('ylO0DQeVEBQ', 'The 33-hour coup that cost Automattic $8 million...'),
                                lockup(
                                  'TbkUKCm3CHQ',
                                  'Did an ex-OpenAI researcher just make reasoning models obsolete?',
                                ),
                                // no title anywhere — unresolvable
                                lockup('Zk3NoTitleA', null),
                                // documented legacy shapes, still in the wild
                                {
                                  richItemRenderer: {
                                    content: {
                                      videoRenderer: {
                                        videoId: 'aaaaaaaaaaa',
                                        title: { runs: [{ text: 'Legacy runs title' }] },
                                      },
                                    },
                                  },
                                },
                                {
                                  richItemRenderer: {
                                    content: {
                                      videoRenderer: {
                                        videoId: 'bbbbbbbbbbb',
                                        title: { simpleText: 'Legacy simpleText title' },
                                      },
                                    },
                                  },
                                },
                                // title that is just the id back again
                                lockup('IdTitleHere', 'IdTitleHere'),
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
    {
      channelMetadataRenderer: {
        title: 'Fireship',
        description: 'High-intensity code tutorials',
        externalId: 'UCsBjURrPoezykLs9EqgamOA',
        rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
      },
    },
  ],
};

const CHANNEL_PAGE = `<!DOCTYPE html><html lang="en"><head><title>Fireship - YouTube</title></head><body><script nonce="kQ8">var ytInitialData = ${JSON.stringify(
  YT_INITIAL_DATA,
)};</script></body></html>`;

const EMPTY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Fireship</title></feed>`;

const HANDLE_PAGE = `<!DOCTYPE html><html><body>{"externalId":"UCsBjURrPoezykLs9EqgamOA"}</body></html>`;

const isVideoIdLike = /^[A-Za-z0-9_-]{11}$/;

/** A ctx that answers the three requests the fallback path makes. */
function makeCtx(channelPage: string = CHANNEL_PAGE): WidgetFetchContext {
  return {
    fetch: vi.fn(async (url: string) => {
      if (url.includes('/videos')) return new Response(channelPage, { status: 200 });
      if (url.includes('/@Fireship')) return new Response(HANDLE_PAGE, { status: 200 });
      return new Response(EMPTY_FEED, { status: 200 });
    }) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const videosFetcher = () => serverWidgets.get('videos')!;

describe('videos: channel-page fallback', () => {
  it('this fixture is the current markup the old title regex could not read', () => {
    // The old parser looked for a title immediately after a videoId. Ids are
    // still all over the page, but only in menu blobs with no title after them.
    const oldPattern = new RegExp(
      `"videoId":"c1rPlzxSZ8E"[^}]*"title":\\{"runs":\\[\\{"text":"([^"]+)"`,
      's',
    );
    expect(oldPattern.test(CHANNEL_PAGE)).toBe(false);
  });

  it('resolves real titles when the channel RSS feed is empty', async () => {
    const data = (await videosFetcher()(makeCtx(), {
      type: 'videos',
      channels: ['@Fireship'],
    })) as { videos: Video[] };

    expect(data.videos.map((v) => v.title)).toEqual([
      'Meta is pivoting again... everything you missed from Connect 2026',
      'The 33-hour coup that cost Automattic $8 million...',
      'Did an ex-OpenAI researcher just make reasoning models obsolete?',
      'Legacy runs title',
      'Legacy simpleText title',
    ]);
    expect(data.videos[0].url).toBe('https://www.youtube.com/watch?v=c1rPlzxSZ8E');
    expect(data.videos[0].thumbnail).toBe('https://i.ytimg.com/vi/c1rPlzxSZ8E/hqdefault.jpg');
  });

  it('names the channel from the scrape, not the raw @handle', async () => {
    const data = (await videosFetcher()(makeCtx(), {
      type: 'videos',
      channels: ['@Fireship'],
    })) as { videos: Video[] };
    expect(new Set(data.videos.map((v) => v.channel))).toEqual(new Set(['Fireship']));
  });

  it('never emits a bare video id as a title', async () => {
    const data = (await videosFetcher()(makeCtx(), {
      type: 'videos',
      channels: ['@Fireship'],
    })) as { videos: Video[] };
    for (const video of data.videos) {
      expect(video.title).not.toMatch(isVideoIdLike);
    }
  });

  it('drops entries whose title cannot be resolved instead of showing the id', () => {
    const parsed = parseChannelPage(CHANNEL_PAGE);
    const titles = parsed.items.map((i) => i.title as string);
    // Zk3NoTitleA has no title node; IdTitleHere's title is its own id.
    expect(titles).not.toContain('Zk3NoTitleA');
    expect(titles).not.toContain('IdTitleHere');
    expect(parsed.items).toHaveLength(5);
  });

  it('reads every documented title shape', () => {
    const parsed = parseChannelPage(CHANNEL_PAGE);
    const byId = new Map(
      parsed.items.map((i) => [i.link as string, i.title as string]),
    );
    expect(byId.get('https://www.youtube.com/watch?v=aaaaaaaaaaa')).toBe('Legacy runs title');
    expect(byId.get('https://www.youtube.com/watch?v=bbbbbbbbbbb')).toBe('Legacy simpleText title');
    expect(byId.get('https://www.youtube.com/watch?v=c1rPlzxSZ8E')).toBe(
      'Meta is pivoting again... everything you missed from Connect 2026',
    );
  });

  it('an RSS entry whose title is an id is dropped too', () => {
    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Mock</title>
  <entry><title>c1rPlzxSZ8E</title><link href="https://www.youtube.com/watch?v=c1rPlzxSZ8E"/></entry>
  <entry><title>Real title</title><link href="https://www.youtube.com/watch?v=ylO0DQeVEBQ"/></entry>
</feed>`;
    const ctx = {
      fetch: vi.fn(async () => new Response(feed, { status: 200 })) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    } satisfies WidgetFetchContext;
    return videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UCsBjURrPoezykLs9EqgamOA'],
    }).then((data) => {
      expect((data as { videos: Video[] }).videos.map((v) => v.title)).toEqual(['Real title']);
    });
  });

  it('a page whose markup changed fails loudly instead of reading as no videos', async () => {
    // The whole point of the fallback is that it works when the feed dies. If
    // YouTube moves the grid, `[]` is a lie: it is indistinguishable from a
    // channel with nothing to show. Parse must throw, and the widget must turn
    // that throw into a visible per-source failure.
    expect(() => parseChannelPage('<html><body>consent wall</body></html>')).toThrow(
      /markup changed: no ytInitialData/,
    );

    const data = (await videosFetcher()(makeCtx('<html><body>consent wall</body></html>'), {
      type: 'videos',
      channels: ['@Fireship'],
    })) as { videos: Video[]; issues: { source: string; reason: string }[] };
    expect(data.videos).toEqual([]);
    expect(data.issues).toEqual([
      { source: '@Fireship', reason: expect.stringContaining('markup changed: no ytInitialData') },
    ]);
  });

  // A raw `UC…` in config used to have no page fallback at all: the feed came
  // back empty and the channel simply disappeared. It has exactly the same
  // second channel a handle has — youtube.com/channel/<UC>/videos.
  it('a UC… channel whose feed is empty falls back to its own /videos page', async () => {
    const seen: string[] = [];
    const ctx = {
      fetch: vi.fn(async (url: string) => {
        seen.push(url);
        if (url.includes('/channel/UCsBjURrPoezykLs9EqgamOA/videos')) {
          return new Response(CHANNEL_PAGE, { status: 200 });
        }
        return new Response(EMPTY_FEED, { status: 200 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    } satisfies WidgetFetchContext;

    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UCsBjURrPoezykLs9EqgamOA'],
    })) as { videos: Video[]; issues: unknown[] };

    expect(seen).toEqual([
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
      'https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA/videos',
    ]);
    expect(data.videos.map((v) => v.title)).toContain(
      'Meta is pivoting again... everything you missed from Connect 2026',
    );
    expect(data.issues).toEqual([]);
  });

  it('the handle page is still scraped through the encoded handle segment', async () => {
    const seen: string[] = [];
    const ctx = {
      fetch: vi.fn(async (url: string) => {
        seen.push(url);
        if (url.includes('/videos')) return new Response(CHANNEL_PAGE, { status: 200 });
        if (url.includes('/@Fireship')) return new Response(HANDLE_PAGE, { status: 200 });
        return new Response(EMPTY_FEED, { status: 200 });
      }) as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    } satisfies WidgetFetchContext;

    await videosFetcher()(ctx, { type: 'videos', channels: ['@Fireship'] });

    expect(seen).toContain('https://www.youtube.com/%40Fireship/videos');
  });
});
