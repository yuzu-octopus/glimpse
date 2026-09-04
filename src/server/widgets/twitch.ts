import {
  TWITCH_CHANNELS_DEFAULTS,
  TWITCH_TOP_GAMES_DEFAULTS,
  twitchChannelsSchema,
  twitchTopGamesSchema,
} from '../../shared/widgets/twitch';
import type { TwitchChannelsData, TwitchGame, TwitchStream, TwitchTopGamesData } from '../../shared/widgets/payloads';
import { fetchJson, fetchWithRetry } from './http';
import { registerWidget, type WidgetFetchContext } from './registry';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX = 'https://api.twitch.tv/helix';

function creds(ctx: WidgetFetchContext): { clientId: string; clientSecret: string } {
  const clientId = ctx.env.TWITCH_CLIENT_ID;
  const clientSecret = ctx.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('twitch widgets need TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET env (Twitch app client-credentials)');
  }
  return { clientId, clientSecret };
}

/** App access token via OAuth client-credentials, cached just short of expiry. */
export async function getTwitchAppToken(ctx: WidgetFetchContext): Promise<string> {
  const { clientId, clientSecret } = creds(ctx);
  const cached = ctx.cache.get<string>('twitch:app-token');
  if (cached !== undefined) return cached;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const res = await fetchWithRetry(ctx, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('twitch token exchange returned no access_token');
  // Cache 60s short of expiry; client secrets stay server-side (headers/body only, never URLs).
  ctx.cache.set('twitch:app-token', json.access_token, Math.max(60_000, ((json.expires_in ?? 3600) - 60) * 1000));
  return json.access_token;
}

function helixHeaders(clientId: string, token: string): Record<string, string> {
  return { 'Client-Id': clientId, Authorization: `Bearer ${token}` };
}

interface HelixUser {
  login?: string;
  display_name?: string;
  profile_image_url?: string;
}

interface HelixStream {
  user_login?: string;
  user_name?: string;
  title?: string;
  game_name?: string;
  viewer_count?: number;
  thumbnail_url?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function helixListUrl(base: string, key: string, values: string[], extra?: string): string {
  const q = new URLSearchParams();
  for (const v of values) q.append(key, v);
  return `${base}?${q.toString()}${extra ?? ''}`;
}

export function twitchSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

registerWidget('twitch-channels', async (ctx, config): Promise<TwitchChannelsData> => {
  const cfg = twitchChannelsSchema.parse(config);
  const { clientId } = creds(ctx);
  const token = await getTwitchAppToken(ctx);
  const headers = helixHeaders(clientId, token);
  const logins = [...new Set(cfg.channels.map((c) => c.toLowerCase()))];

  const users = new Map<string, HelixUser>();
  for (const group of chunk(logins, 100)) {
    const json = await fetchJson<{ data?: HelixUser[] }>(ctx, helixListUrl(`${HELIX}/users`, 'login', group), { headers });
    for (const u of json.data ?? []) if (u.login) users.set(u.login.toLowerCase(), u);
  }
  const live = new Map<string, HelixStream>();
  for (const group of chunk(logins, 100)) {
    const json = await fetchJson<{ data?: HelixStream[] }>(ctx, helixListUrl(`${HELIX}/streams`, 'user_login', group), { headers });
    for (const s of json.data ?? []) if (s.user_login) live.set(s.user_login.toLowerCase(), s);
  }

  const streams: TwitchStream[] = logins.map((login) => {
    const u = users.get(login);
    const s = live.get(login);
    const name = u?.display_name || s?.user_name || login;
    if (!s) {
      return {
        login, displayName: name, title: '', gameName: '', viewerCount: 0,
        thumbnailUrl: null, profileImageUrl: u?.profile_image_url || null,
        url: `https://www.twitch.tv/${login}`, live: false,
      };
    }
    return {
      login,
      displayName: name,
      title: s.title ?? '',
      gameName: s.game_name ?? '',
      viewerCount: s.viewer_count ?? 0,
      thumbnailUrl: s.thumbnail_url ? s.thumbnail_url.replace('{width}', '320').replace('{height}', '180') : null,
      profileImageUrl: u?.profile_image_url || null,
      url: `https://www.twitch.tv/${login}`,
      live: true,
    };
  });

  const sortBy = cfg['sort-by'] ?? TWITCH_CHANNELS_DEFAULTS['sort-by'];
  streams.sort((a, b) =>
    sortBy === 'live'
      ? Number(b.live) - Number(a.live) || b.viewerCount - a.viewerCount || a.displayName.localeCompare(b.displayName)
      : b.viewerCount - a.viewerCount || Number(b.live) - Number(a.live) || a.displayName.localeCompare(b.displayName),
  );
  return streams;
});

interface HelixGame {
  id?: string;
  name?: string;
  box_art_url?: string;
}

registerWidget('twitch-top-games', async (ctx, config): Promise<TwitchTopGamesData> => {
  const cfg = twitchTopGamesSchema.parse(config);
  const { clientId } = creds(ctx);
  const token = await getTwitchAppToken(ctx);
  const headers = helixHeaders(clientId, token);
  const limit = cfg.limit ?? TWITCH_TOP_GAMES_DEFAULTS.limit;
  const excluded = new Set((cfg.exclude ?? []).map((e) => twitchSlug(e)));
  // Over-fetch past the excludes so the final list still fills `limit`.
  const first = Math.min(100, limit + excluded.size);
  const json = await fetchJson<{ data?: HelixGame[] }>(ctx, `${HELIX}/games/top?first=${first}`, { headers });
  const games: TwitchGame[] = [];
  for (const g of json.data ?? []) {
    if (games.length >= limit) break;
    const name = g.name ?? '';
    if (!name || excluded.has(twitchSlug(name))) continue;
    games.push({
      id: g.id ?? '',
      name,
      boxArtUrl: g.box_art_url ? g.box_art_url.replace('{width}', '285').replace('{height}', '380') : null,
      url: `https://www.twitch.tv/directory/category/${twitchSlug(name)}`,
    });
  }
  return games;
});
