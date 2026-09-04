import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './twitch';
import type { TwitchChannelsData, TwitchTopGamesData } from '../../shared/widgets/payloads';

const TOKEN = { access_token: 'tok', expires_in: 3600, token_type: 'bearer' };
const USERS = {
  data: [
    { login: 'shroud', display_name: 'Shroud', profile_image_url: 'https://img/shroud.png' },
    { login: 'xqc', display_name: 'xQc', profile_image_url: 'https://img/xqc.png' },
  ],
};
const STREAMS = {
  data: [
    {
      user_login: 'xqc', user_name: 'xQc', title: 'Variety day', game_name: 'Just Chatting',
      viewer_count: 42000, thumbnail_url: 'https://img/live-{width}x{height}.jpg',
    },
  ],
};
const GAMES = {
  data: [
    { id: '1', name: 'Just Chatting', box_art_url: 'https://img/chat-{width}x{height}.jpg' },
    { id: '2', name: 'League of Legends', box_art_url: 'https://img/lol-{width}x{height}.jpg' },
    { id: '3', name: 'Music', box_art_url: 'https://img/music-{width}x{height}.jpg' },
  ],
};

function makeCtx(): WidgetFetchContext {
  const fetchImpl = async (url: string | URL | Request): Promise<Response> => {
    const u = String(url);
    if (u.includes('oauth2/token')) return new Response(JSON.stringify(TOKEN), { status: 200 });
    if (u.includes('/helix/users')) return new Response(JSON.stringify(USERS), { status: 200 });
    if (u.includes('/helix/streams')) return new Response(JSON.stringify(STREAMS), { status: 200 });
    if (u.includes('/helix/games/top')) return new Response(JSON.stringify(GAMES), { status: 200 });
    throw new Error(`unexpected fetch: ${u}`);
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' },
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const channels = () => serverWidgets.get('twitch-channels')!;
const games = () => serverWidgets.get('twitch-top-games')!;

describe('twitch-channels fetcher', () => {
  it('registers a fetcher', () => {
    expect(channels()).toBeDefined();
  });

  it('maps live + offline channels sorted by viewers', async () => {
    const data = (await channels()(makeCtx(), {
      type: 'twitch-channels', channels: ['shroud', 'xqc'],
    })) as TwitchChannelsData;
    expect(data).toHaveLength(2);
    expect(data[0].login).toBe('xqc');
    expect(data[0].live).toBe(true);
    expect(data[0].viewerCount).toBe(42000);
    expect(data[0].thumbnailUrl).toBe('https://img/live-320x180.jpg');
    expect(data[0].url).toBe('https://www.twitch.tv/xqc');
    expect(data[1].login).toBe('shroud');
    expect(data[1].live).toBe(false);
    expect(data[1].profileImageUrl).toBe('https://img/shroud.png');
  });

  it('sort-by live keeps live first', async () => {
    const data = (await channels()(makeCtx(), {
      type: 'twitch-channels', channels: ['shroud', 'xqc'], 'sort-by': 'live',
    })) as TwitchChannelsData;
    expect(data[0].live).toBe(true);
    expect(data[1].live).toBe(false);
  });

  it('throws without client credentials', async () => {
    const ctx = makeCtx();
    ctx.env = {};
    await expect(channels()(ctx, { type: 'twitch-channels', channels: ['xqc'] })).rejects.toThrow(
      /TWITCH_CLIENT_ID/,
    );
  });
});

describe('twitch-top-games fetcher', () => {
  it('registers a fetcher', () => {
    expect(games()).toBeDefined();
  });

  it('maps box art templates and fills rank order', async () => {
    const data = (await games()(makeCtx(), { type: 'twitch-top-games', limit: 2 })) as TwitchTopGamesData;
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Just Chatting');
    expect(data[0].boxArtUrl).toBe('https://img/chat-285x380.jpg');
    expect(data[0].url).toBe('https://www.twitch.tv/directory/category/just-chatting');
  });

  it('drops excluded slugs', async () => {
    const data = (await games()(makeCtx(), {
      type: 'twitch-top-games', limit: 3, exclude: ['just-chatting', 'music'],
    })) as TwitchTopGamesData;
    expect(data.map((g) => g.name)).toEqual(['League of Legends']);
  });

  it('throws without client credentials', async () => {
    const ctx = makeCtx();
    ctx.env = {};
    await expect(games()(ctx, { type: 'twitch-top-games' })).rejects.toThrow(/TWITCH_CLIENT_ID/);
  });
});
