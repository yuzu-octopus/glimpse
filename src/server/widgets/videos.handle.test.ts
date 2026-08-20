import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './videos';
import { extractChannelId } from './videos';
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

describe('Task 3: YouTube @handle primary', () => {
  it('@spokeishere resolves to UCk2ux (case-insensitive)', async () => {
    const spokeHtml = `{"externalId":"UCk2uxbWi5py_iJXaEsh2YRA","browseId":"UCk2uxbWi5py_iJXaEsh2YRA"}`;
    let handleFetchCount = 0;
    const ctx = makeCtx(async (url) => {
      if (url.includes('youtube.com/@')) {
        handleFetchCount++;
        expect(url).toMatch(/youtube\.com\/@/);
        return new Response(spokeHtml, { status: 200 });
      }
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCk2uxbWi5py_iJXaEsh2YRA');
      return new Response(FEED, { status: 200 });
    });
    const data1 = (await videosFetcher()(ctx, { type: 'videos', channels: ['@SpokeIsHere'] })) as { videos: Video[] };
    expect(data1.videos).toHaveLength(1);
    const data2 = (await videosFetcher()(ctx, { type: 'videos', channels: ['@spokeishere'] })) as { videos: Video[] };
    expect(data2.videos).toHaveLength(1);
    expect(handleFetchCount).toBeGreaterThanOrEqual(1);
  });

  it('@Bug-I with hyphen resolves via browseId', async () => {
    const bugHtml = `{"browseId":"UCeUHo1UGx4p97AQllOYuneA"}`;
    const ctx = makeCtx(async (url) => {
      if (url.includes('youtube.com/@')) {
        expect(url).toContain('Bug-I');
        return new Response(bugHtml, { status: 200 });
      }
      expect(url).toContain('channel_id=UCeUHo1UGx4p97AQllOYuneA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['@Bug-I'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
  });

  it('bare handle without @ also resolves (e.g. spokeishere)', async () => {
    const html = `{"externalId":"UCk2uxbWi5py_iJXaEsh2YRA"}`;
    const ctx = makeCtx(async (url) => {
      if (url.includes('youtube.com/@')) {
        expect(url).toBe('https://www.youtube.com/@spokeishere');
        return new Response(html, { status: 200 });
      }
      expect(url).toContain('UCk2uxbWi5py_iJXaEsh2YRA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['spokeishere'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
  });

  it('UC fallback still works (no handle fetch)', async () => {
    let handleFetched = false;
    const ctx = makeCtx(async (url) => {
      if (url.includes('youtube.com/@')) handleFetched = true;
      expect(url).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA');
      return new Response(FEED, { status: 200 });
    });
    const data = (await videosFetcher()(ctx, { type: 'videos', channels: ['UCsBjURrPoezykLs9EqgamOA'] })) as { videos: Video[] };
    expect(data.videos).toHaveLength(1);
    expect(handleFetched).toBe(false);
  });

  it('sends Mozilla User-Agent on handle and feed fetches', async () => {
    const uas: string[] = [];
    const html = `{"externalId":"UC1234567890123456789012"}`;
    const ctx: WidgetFetchContext = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const h = (init?.headers as Record<string, string> | undefined) ?? {};
        if (h['User-Agent']) uas.push(h['User-Agent']);
        if ((_url as string).includes('youtube.com/@')) return new Response(html, { status: 200 });
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
