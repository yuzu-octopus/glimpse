import {
  twitchChannelsSchema,
  twitchTopGamesSchema,
} from '../../shared/widgets/keyed';
import { fetchJson } from './http';
import { registerWidget, type WidgetFetchContext } from './registry';
import type { TwitchChannel, TwitchGame } from '../../shared/widgets/payloads';

interface TwitchTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface TwitchUser {
  id?: string;
  login?: string;
  display_name?: string;
}

interface TwitchStream {
  user_login?: string;
  title?: string;
  game_name?: string;
  viewer_count?: number;
  thumbnail_url?: string;
}

/** App-access token, cached in ctx.cache until expiry. */
export async function getTwitchToken(ctx: WidgetFetchContext): Promise<string> {
  const cached = ctx.cache.get<string>('twitch:token');
  if (cached) return cached;

  const clientId = ctx.env.TWITCH_CLIENT_ID;
  const clientSecret = ctx.env.TWITCH_CLIENT_SECRET;
  if (!clientId) throw new Error('TWITCH_CLIENT_ID env var is missing');
  if (!clientSecret) throw new Error('TWITCH_CLIENT_SECRET env var is missing');

  const res = await ctx.fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for Twitch token`);
  const payload = (await res.json()) as TwitchTokenResponse;
  if (!payload.access_token) throw new Error('Twitch token response missing access_token');
  if (payload.expires_in) {
    ctx.cache.set('twitch:token', payload.access_token, payload.expires_in * 1000);
  }
  return payload.access_token;
}

function helixHeaders(ctx: WidgetFetchContext, token: string): Record<string, string> {
  return {
    'Client-Id': ctx.env.TWITCH_CLIENT_ID!,
    Authorization: `Bearer ${token}`,
  };
}

registerWidget('twitch-channels', async (ctx, config) => {
  const cfg = twitchChannelsSchema.parse(config);
  const token = await getTwitchToken(ctx);
  const headers = helixHeaders(ctx, token);

  const logins = cfg.channels.map(encodeURIComponent);
  const [usersRes, streamsRes] = await Promise.all([
    fetchJson<{ data: TwitchUser[] }>(
      ctx,
      `https://api.twitch.tv/helix/users?login=${logins.join('&login=')}`,
      { headers },
    ),
    fetchJson<{ data: TwitchStream[] }>(
      ctx,
      `https://api.twitch.tv/helix/streams?user_login=${logins.join('&user_login=')}`,
      { headers },
    ),
  ]);
  const users = usersRes.data;
  const streams = new Map(streamsRes.data.map((s) => [s.user_login, s]));

  const channels: TwitchChannel[] = users.map((u) => {
    const stream = streams.get(u.login);
    return {
      login: u.login ?? '',
      displayName: u.display_name ?? u.login ?? '',
      live: Boolean(stream),
      viewers: stream?.viewer_count ?? 0,
      title: stream?.title ?? null,
      game: stream?.game_name ?? null,
      thumbnail: stream?.thumbnail_url?.replace('{width}x{height}', '320x180') ?? null,
    };
  });

  const sortBy = cfg['sort-by'] ?? 'viewers';
  channels.sort((a, b) => {
    if (sortBy === 'live') {
      if (a.live !== b.live) return a.live ? -1 : 1;
      return b.viewers - a.viewers;
    }
    return b.viewers - a.viewers;
  });
  return { channels };
});

registerWidget('twitch-top-games', async (ctx, config) => {
  const cfg = twitchTopGamesSchema.parse(config);
  const token = await getTwitchToken(ctx);
  const headers = helixHeaders(ctx, token);

  const limit = cfg.limit ?? 5;
  const res = await fetchJson<{
    data: Array<{ id?: string; name?: string; box_art_url?: string }>;
  }>(ctx, `https://api.twitch.tv/helix/games/top?first=${limit}`, { headers });

  const excluded = new Set(cfg.exclude.map((e) => e.toLowerCase()));
  const games: TwitchGame[] = res.data.flatMap((g) =>
    excluded.has((g.name ?? '').toLowerCase())
      ? []
      : [
          {
            id: g.id ?? '',
            name: g.name ?? '',
            thumbnail: g.box_art_url?.replace('{width}x{height}', '144x192') ?? null,
          },
        ],
  );
  return { games };
});
