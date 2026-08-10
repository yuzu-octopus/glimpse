import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './reddit';
import type { RedditPost } from './reddit';

const LISTING = {
  data: {
    children: [
      {
        data: {
          title: 'Great post',
          url: 'https://example.com/article',
          permalink: '/r/selfhosted/comments/abc/great_post/',
          thumbnail: 'https://example.com/thumb.jpg',
          link_flair_text: 'Discussion',
          score: 123,
          num_comments: 45,
          created_utc: 1_700_000_000,
        },
      },
      {
        data: {
          title: 'Self post',
          url: 'https://www.reddit.com/r/selfhosted/comments/def/self_post/',
          permalink: '/r/selfhosted/comments/def/self_post/',
          thumbnail: 'self',
          score: 1,
          num_comments: 0,
          created_utc: 1_700_000_000,
        },
      },
    ],
  },
};

function makeCtx(payload: unknown): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  return {
    ctx: {
      fetch: fetchMock as unknown as typeof fetch,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    },
    fetchMock,
  };
}

const redditFetcher = () => serverWidgets.get('reddit')!;


describe('reddit fetcher', () => {
  it('maps posts and filters invalid thumbnails', async () => {
    const { ctx } = makeCtx(LISTING);
    const data = (await redditFetcher()(ctx, { type: 'reddit', subreddit: 'selfhosted' })) as { posts: RedditPost[] };
    expect(data.posts).toHaveLength(2);
    expect(data.posts[0].thumbnail).toBe('https://example.com/thumb.jpg');
    expect(data.posts[0].flair).toBe('Discussion');
    expect(data.posts[0].commentsUrl).toBe('https://www.reddit.com/r/selfhosted/comments/abc/great_post/');
    expect(data.posts[1].thumbnail).toBeNull();
  });

  it('builds the search URL when search is set', async () => {
    const { ctx, fetchMock } = makeCtx({ data: { children: [] } });
    await redditFetcher()(ctx, { type: 'reddit', subreddit: 'selfhosted', search: 'docker' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/search.json?q=docker');
  });
});
