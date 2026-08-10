import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './lobsters';
import type { LobsterPost } from './lobsters';

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

const lobstersFetcher = () => serverWidgets.get('lobsters')!;

const STORIES = [
  {
    id: 1,
    title: 'Rust post',
    url: 'https://example.com/rust',
    comments_url: 'https://lobste.rs/s/abc/rust-post',
    score: 42,
    comment_count: 7,
    created_at: '2024-01-01T10:00:00Z',
    tags: ['rust', 'programming'],
  },
  {
    id: 2,
    title: 'Cooking post',
    url: 'https://example.com/cooking',
    comments_url: 'https://lobste.rs/s/def/cooking-post',
    score: 5,
    comment_count: 1,
    created_at: '2024-01-02T10:00:00Z',
    tags: ['cooking'],
  },
];

describe('lobsters fetcher', () => {
  it('maps stories and applies the limit', async () => {
    const ctx = makeCtx({ 'https://lobste.rs/hottest.json': STORIES });
    const data = (await lobstersFetcher()(ctx, { type: 'lobsters', limit: 1 })) as { posts: LobsterPost[] };
    expect(data.posts).toHaveLength(1);
    const p = data.posts[0];
    expect(p.title).toBe('Rust post');
    expect(p.commentsUrl).toBe('https://lobste.rs/s/abc/rust-post');
    expect(p.score).toBe(42);
    expect(p.comments).toBe(7);
    expect(p.tags).toEqual(['rust', 'programming']);
    expect(p.ageSeconds).toBeGreaterThan(0);
  });

  it('filters by tags and uses the new endpoint', async () => {
    const ctx = makeCtx({ 'https://lobste.rs/newest.json': STORIES });
    const data = (await lobstersFetcher()(ctx, {
      type: 'lobsters',
      'sort-by': 'new',
      tags: ['rust'],
    })) as { posts: LobsterPost[] };
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].title).toBe('Rust post');
  });

  it('honors a custom instance URL', async () => {
    const ctx = makeCtx({ 'https://example.lobste.rs/hottest.json': STORIES });
    const data = (await lobstersFetcher()(ctx, {
      type: 'lobsters',
      'instance-url': 'https://example.lobste.rs',
    })) as { posts: LobsterPost[] };
    expect(data.posts).toHaveLength(2);
  });

  it('returns an empty list for an empty payload', async () => {
    const ctx = makeCtx({ 'https://lobste.rs/hottest.json': [] });
    const data = (await lobstersFetcher()(ctx, { type: 'lobsters' })) as { posts: LobsterPost[] };
    expect(data.posts).toEqual([]);
  });
});
