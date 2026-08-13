import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './twitch';
import type { TwitchChannel, TwitchGame } from '../../shared/widgets/payloads';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

function makeCtx(
  routes: Record<string, unknown>,
  env: Record<string, string | undefined> = {},
): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = init?.method === 'POST' ? `${init.method} ${url}` : url;
    const hit = routes[key];
    if (hit === undefined) return new Response('{"error":"not found"}', { status: 404 });
    return new Response(JSON.stringify(hit), { status: 200 });
  });
  return {
    ctx: {
      fetch: fetchMock as unknown as typeof fetch,
      env,
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    },
    fetchMock,
  };
}

const ENV = { TWITCH_CLIENT_ID: 'client-1', TWITCH_CLIENT_SECRET: 'secret-1' };
const TOKEN = { access_token: 'tok-1', expires_in: 3600 };
const USERS_URL = 'https://api.twitch.tv/helix/users?login=a&login=b';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams?user_login=a&user_login=b';

const twitchChannelsFetcher = () => serverWidgets.get('twitch-channels')!;
const twitchTopGamesFetcher = () => serverWidgets.get('twitch-top-games')!;

describe('twitch token helper', () => {
  it('caches the token: second call does not POST again', async () => {
    const { ctx, fetchMock } = makeCtx({
      [`POST ${TOKEN_URL}`]: TOKEN,
      'https://api.twitch.tv/helix/users?login=a': { data: [{ login: 'a', display_name: 'A' }] },
      'https://api.twitch.tv/helix/streams?user_login=a': { data: [] },
    }, ENV);
    await twitchChannelsFetcher()(ctx, { type: 'twitch-channels', channels: ['a'] });
    await twitchChannelsFetcher()(ctx, { type: 'twitch-channels', channels: ['a'] });
    const tokenPosts = fetchMock.mock.calls.filter(
      (c) => String(c[0]) === TOKEN_URL,
    );
    expect(tokenPosts).toHaveLength(1);
  });

  it('throws a clear error naming a missing env var', async () => {
    const { ctx } = makeCtx({}, {});
    await expect(
      twitchChannelsFetcher()(ctx, { type: 'twitch-channels', channels: ['a'] }),
    ).rejects.toThrow('TWITCH_CLIENT_ID env var is missing');
  });
});

describe('twitch-channels fetcher', () => {
  it('merges users with live streams and maps fields', async () => {
    const { ctx } = makeCtx({
      [`POST ${TOKEN_URL}`]: TOKEN,
      [USERS_URL]: {
        data: [
          { id: '1', login: 'a', display_name: 'Alpha' },
          { id: '2', login: 'b', display_name: 'Beta' },
        ],
      },
      [STREAMS_URL]: {
        data: [
          {
            user_login: 'a',
            title: 'Streaming now',
            game_name: 'Chess',
            viewer_count: 99,
            thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_a-{width}x{height}.jpg',
          },
        ],
      },
    }, ENV);
    const data = (await twitchChannelsFetcher()(ctx, {
      type: 'twitch-channels',
      channels: ['a', 'b'],
    })) as { channels: TwitchChannel[] };
    expect(data.channels).toHaveLength(2);
    const live = data.channels[0];
    expect(live.login).toBe('a');
    expect(live.displayName).toBe('Alpha');
    expect(live.live).toBe(true);
    expect(live.viewers).toBe(99);
    expect(live.title).toBe('Streaming now');
    expect(live.game).toBe('Chess');
    expect(live.thumbnail).toBe('https://static-cdn.jtvnw.net/previews-ttv/live_user_a-320x180.jpg');
    expect(data.channels[1].live).toBe(false);
    expect(data.channels[1].viewers).toBe(0);
    expect(data.channels[1].title).toBeNull();
  });

  it('sort-by live puts live channels first', async () => {
    const { ctx } = makeCtx({
      [`POST ${TOKEN_URL}`]: TOKEN,
      'https://api.twitch.tv/helix/users?login=offline&login=small&login=big': {
        data: [
          { login: 'offline', display_name: 'Off' },
          { login: 'small', display_name: 'Small' },
          { login: 'big', display_name: 'Big' },
        ],
      },
      'https://api.twitch.tv/helix/streams?user_login=offline&user_login=small&user_login=big': {
        data: [
          { user_login: 'small', viewer_count: 10 },
          { user_login: 'big', viewer_count: 500 },
        ],
      },
    }, ENV);
    const data = (await twitchChannelsFetcher()(ctx, {
      type: 'twitch-channels',
      channels: ['offline', 'small', 'big'],
      'sort-by': 'live',
    })) as { channels: TwitchChannel[] };
    expect(data.channels.map((c) => c.login)).toEqual(['big', 'small', 'offline']);
  });
});

describe('twitch-top-games fetcher', () => {
  it('maps games, filters excludes case-insensitively and replaces thumbnail size', async () => {
    const { ctx } = makeCtx({
      [`POST ${TOKEN_URL}`]: TOKEN,
      'https://api.twitch.tv/helix/games/top?first=10': {
        data: [
          { id: '1', name: 'Chess', box_art_url: 'https://static-cdn.jtvnw.net/chess-{width}x{height}.jpg' },
          { id: '2', name: 'Dota 2', box_art_url: 'https://static-cdn.jtvnw.net/dota-{width}x{height}.jpg' },
        ],
      },
    }, ENV);
    const data = (await twitchTopGamesFetcher()(ctx, {
      type: 'twitch-top-games',
      exclude: ['dota 2'],
    })) as { games: TwitchGame[] };
    expect(data.games).toHaveLength(1);
    expect(data.games[0]).toEqual({
      id: '1',
      name: 'Chess',
      thumbnail: 'https://static-cdn.jtvnw.net/chess-144x192.jpg',
    });
  });

  it('honors the limit parameter', async () => {
    const { ctx } = makeCtx({
      [`POST ${TOKEN_URL}`]: TOKEN,
      'https://api.twitch.tv/helix/games/top?first=3': {
        data: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
      },
    }, ENV);
    const data = (await twitchTopGamesFetcher()(ctx, {
      type: 'twitch-top-games',
      limit: 3,
    })) as { games: TwitchGame[] };
    expect(data.games).toHaveLength(2);
    expect(data.games[0].thumbnail).toBeNull(); // box_art_url absent
  });
});
