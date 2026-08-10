import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './hacker-news';
import type { HnPost } from './hacker-news';

function makeCtx(routes: Record<string, unknown>): WidgetFetchContext {
  const fetchImpl = async (url: string) => {
    const hit = routes[url];
    if (hit === undefined) return new Response('{"error":"not found"}', { status: 404 });
    return new Response(JSON.stringify(hit), { status: 200 });
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const hnFetcher = () => serverWidgets.get('hacker-news')!;


describe('hacker-news fetcher', () => {
  it('fetches ids then items and maps fields', async () => {
    const routes = {
      'https://hacker-news.firebaseio.com/v0/topstories.json': [101, 102],
      'https://hacker-news.firebaseio.com/v0/item/101.json': {
        id: 101, title: 'Post one', url: 'https://example.com/1', score: 42, descendants: 7, time: 1_700_000_000,
      },
      'https://hacker-news.firebaseio.com/v0/item/102.json': {
        id: 102, title: 'Post two', score: 10, time: 1_700_000_000,
      },
    };
    const data = (await hnFetcher()(makeCtx(routes), { type: 'hacker-news' })) as { posts: HnPost[] };
    expect(data.posts).toHaveLength(2);
    expect(data.posts[0].url).toBe('https://example.com/1');
    expect(data.posts[0].score).toBe(42);
    expect(data.posts[0].comments).toBe(7);
    // no url → HN item page
    expect(data.posts[1].url).toBe('https://news.ycombinator.com/item?id=102');
  });

  it('supports engagement sorting', async () => {
    const routes = {
      'https://hacker-news.firebaseio.com/v0/newstories.json': [1, 2],
      'https://hacker-news.firebaseio.com/v0/item/1.json': { id: 1, title: 'Low', score: 1, descendants: 1, time: 1_700_000_000 },
      'https://hacker-news.firebaseio.com/v0/item/2.json': { id: 2, title: 'High', score: 99, descendants: 99, time: 1_700_000_000 },
    };
    const data = (await hnFetcher()(makeCtx(routes), { type: 'hacker-news', 'sort-by': 'new', 'extra-sort-by': 'engagement' })) as { posts: HnPost[] };
    expect(data.posts[0].title).toBe('High');
  });

  it('drops null items and applies the limit', async () => {
    const routes = {
      'https://hacker-news.firebaseio.com/v0/topstories.json': [1, 2, 3],
      'https://hacker-news.firebaseio.com/v0/item/1.json': { id: 1, title: 'A', time: 1_700_000_000 },
      'https://hacker-news.firebaseio.com/v0/item/2.json': null,
      'https://hacker-news.firebaseio.com/v0/item/3.json': { id: 3, title: 'B', time: 1_700_000_000 },
    };
    const data = (await hnFetcher()(makeCtx(routes), { type: 'hacker-news', limit: 1 })) as { posts: HnPost[] };
    expect(data.posts).toHaveLength(1);
  });
});
