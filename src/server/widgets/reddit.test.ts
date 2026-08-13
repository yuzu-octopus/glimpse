import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './reddit';
import type { RedditPost } from '../../shared/widgets/payloads';

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

function makeCtx(
  routes: Record<string, unknown> | unknown,
): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: string) => {
    const hit =
      routes && typeof routes === 'object' && !Array.isArray(routes) && url in (routes as Record<string, unknown>)
        ? (routes as Record<string, unknown>)[url]
        : routes;
    return new Response(JSON.stringify(hit), { status: 200 });
  });
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

  it('replaces {REQUEST-URL} in the request-url-template', async () => {
    const { ctx, fetchMock } = makeCtx({ data: { children: [] } });
    await redditFetcher()(ctx, {
      type: 'reddit',
      subreddit: 'selfhosted',
      'request-url-template': 'https://proxy.local/{REQUEST-URL}',
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://proxy.local/https://www.reddit.com/r/selfhosted/hot.json?limit=10&t=day');
  });

  it('passes the proxy option to fetch', async () => {
    const { ctx, fetchMock } = makeCtx({ data: { children: [] } });
    await redditFetcher()(ctx, {
      type: 'reddit',
      subreddit: 'selfhosted',
      proxy: 'https://user:pass@proxy.com:8080',
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ proxy: 'https://user:pass@proxy.com:8080' });
  });

  it('accepts object-form proxy and refuses insecure http proxies unless allow-insecure', async () => {
    const { ctx, fetchMock } = makeCtx({ data: { children: [] } });
    await redditFetcher()(ctx, {
      type: 'reddit',
      subreddit: 'selfhosted',
      proxy: { url: 'http://proxy.com:8080', 'allow-insecure': true, timeout: '5s' },
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ proxy: 'http://proxy.com:8080' });

    await expect(
      redditFetcher()(ctx, { type: 'reddit', subreddit: 'selfhosted', proxy: 'http://proxy.com:8080' }),
    ).rejects.toThrow(/allow-insecure/);
  });

  it('fetches an app-auth token and sends it as a Bearer header', async () => {
    const { ctx, fetchMock } = makeCtx({
      'https://www.reddit.com/api/v1/access_token': { access_token: 'tok123', expires_in: 3600 },
      'https://www.reddit.com/r/selfhosted/hot.json?limit=10&t=day': { data: { children: [] } },
    });
    await redditFetcher()(ctx, {
      type: 'reddit',
      subreddit: 'selfhosted',
      'app-auth': { name: 'glimpse', id: 'client-id', secret: 'client-secret' },
    });

    const [tokenUrl, tokenOpts] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://www.reddit.com/api/v1/access_token');
    expect(tokenOpts.method).toBe('POST');
    expect(tokenOpts.headers.Authorization).toBe(`Basic ${btoa('client-id:client-secret')}`);
    expect(tokenOpts.body).toBe('grant_type=client_credentials');

    const [, listingOpts] = fetchMock.mock.calls[1];
    expect(listingOpts.headers.Authorization).toBe('Bearer tok123');
  });

  it('reuses the cached token across calls', async () => {
    const { ctx, fetchMock } = makeCtx({
      'https://www.reddit.com/api/v1/access_token': { access_token: 'tok123' },
      'https://www.reddit.com/r/selfhosted/hot.json?limit=10&t=day': { data: { children: [] } },
    });
    const cfg = { type: 'reddit', subreddit: 'selfhosted', 'app-auth': { id: 'a', secret: 'b' } };
    await redditFetcher()(ctx, cfg);
    await redditFetcher()(ctx, cfg);
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://www.reddit.com/api/v1/access_token');
    expect(tokenCalls).toHaveLength(1);
  });

  it('sorts by engagement when extra-sort-by is set', async () => {
    const listing = {
      data: {
        children: [
          { data: { title: 'Low score', score: 100, num_comments: 0, created_utc: 1 } },
          { data: { title: 'High engagement', score: 10, num_comments: 500, created_utc: 1 } },
        ],
      },
    };
    const { ctx } = makeCtx(listing);
    const data = (await redditFetcher()(ctx, {
      type: 'reddit',
      subreddit: 'selfhosted',
      'extra-sort-by': 'engagement',
    })) as { posts: RedditPost[] };
    expect(data.posts[0].title).toBe('High engagement');
    expect(data.posts[1].title).toBe('Low score');
  });
});
