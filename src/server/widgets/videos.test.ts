import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './videos';
import type { Video } from './videos';

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

  it('resolves @handles to the user feed', async () => {
    const ctx = makeCtx(async (url) => {
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?user=handle');
      return new Response(FEED, { status: 200 });
    });
    await videosFetcher()(ctx, { type: 'videos', channels: ['@handle'] });
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

  it('returns an empty list for an empty feed', async () => {
    const empty = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title></feed>`;
    const ctx = makeCtx(async () => new Response(empty, { status: 200 }));
    const data = (await videosFetcher()(ctx, {
      type: 'videos',
      channels: ['UC1234567890123456789012'],
    })) as { videos: Video[] };
    expect(data.videos).toEqual([]);
  });
});
