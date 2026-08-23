import { REDDIT_DEFAULTS, redditSchema } from '../../shared/widgets/feeds';
import { parseCacheDuration } from '../cache';
import { fetchWithRetry, type HttpOptions } from './http';
import { compareEngagement } from './engagement';
import { registerWidget, type WidgetFetchContext } from './registry';
import type { RedditPost } from '../../shared/widgets/payloads';
interface RedditChild {
  data: {
    title?: string;
    url?: string;
    permalink?: string;
    thumbnail?: string;
    link_flair_text?: string | null;
    score?: number;
    num_comments?: number;
    created_utc?: number;
  };
}

interface RedditListing {
  data?: { children?: RedditChild[] };
}

const VALID_THUMB = (t: string | undefined): t is string =>
  typeof t === 'string' && t.startsWith('http');

const UA_MOZILLA = 'Mozilla/5.0 (compatible; glimpse/0.1)';
const USER_AGENT = UA_MOZILLA;


interface ProxyConfig {
  url: string;
  'allow-insecure'?: boolean;
  timeout?: string;
}

function hashSecret(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function redditTokenKey(id: string, secret: string): string {
  return `reddit:token:${id}:${hashSecret(secret)}`;
}

/** Reddit app-only OAuth: token cached for ~1h (Reddit tokens live 24h). */
async function getAccessToken(
  ctx: WidgetFetchContext,
  appAuth: { id: string; secret: string },
): Promise<string> {
  const key = redditTokenKey(appAuth.id, appAuth.secret);
  const cached = ctx.cache.get<string>(key);
  if (cached) return cached;
  return ctx.singleflight.run(key, async () => {
    const again = ctx.cache.get<string>(key);
    if (again) return again;
    let res: Response;
    try {
      res = await fetchWithRetry(ctx, 'https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${appAuth.id}:${appAuth.secret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      const m = /HTTP (\d+)/.exec(String((err as Error).message));
      if (m) throw new Error(`reddit token: HTTP ${m[1]}`);
      throw err;
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('reddit token: no access_token in response');

    const ttl = Math.min((body.expires_in ?? 3600) * 1000, 3600_000);
    ctx.cache.set(key, body.access_token, ttl);
    return body.access_token;
  });
}

registerWidget('reddit', async (ctx, config) => {
  const cfg = redditSchema.parse(config);
  const limit = cfg.limit ?? REDDIT_DEFAULTS.limit;
  const sort = cfg['sort-by'] ?? 'hot';
  const period = cfg['top-period'] ?? 'day';

  const proxy: ProxyConfig | undefined =
    typeof cfg.proxy === 'string' ? { url: cfg.proxy } : cfg.proxy;
  if (proxy && proxy.url.startsWith('http://') && !proxy['allow-insecure']) {
    throw new Error(
      `reddit: insecure proxy "${proxy.url}" requires allow-insecure: true`,
    );
  }

  const isAuthed = !!cfg['app-auth'];
  const host = isAuthed ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  let url = cfg.search
    ? `${host}/search.json?q=${encodeURIComponent(cfg.search)}&sort=${sort}&t=${period}&limit=${limit}`
    : `${host}/r/${encodeURIComponent(cfg.subreddit)}/${sort}.json?limit=${limit}&t=${period}`;
  if (cfg['request-url-template']) {
    url = cfg['request-url-template'].replace('{REQUEST-URL}', url);
  }

  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cfg['app-auth']) {
    headers.Authorization = `Bearer ${await getAccessToken(ctx, cfg['app-auth'])}`;
  }

  let res: Response;
  try {
    res = await fetchWithRetry(
      ctx,
      url,
      {
        headers,
        timeoutMs: parseCacheDuration(proxy?.timeout, 15_000),
        ...(proxy ? { proxy: proxy.url } : {}),
      } as unknown as HttpOptions & { proxy?: string },
    );
  } catch (err) {
    const msg = String((err as Error).message);
    if (msg.includes('403') && !cfg['app-auth']) {
      throw new Error(`${msg} — anonymous Reddit JSON is now blocked (403); add reddit.app-auth id/secret or proxy/request-url-template to fetch via OAuth`);
    }
    throw err;
  }
  const listing = (await res.json()) as RedditListing;

  const posts: RedditPost[] = (listing.data?.children ?? []).flatMap((c) =>
    typeof c.data.title === 'string'
      ? [
          {
            title: c.data.title,
            url: c.data.url ?? '',
            commentsUrl:
              cfg['comments-url-template']?.replace('{PERMALINK}', c.data.permalink ?? '') ??
              `https://www.reddit.com${c.data.permalink ?? ''}`,
            thumbnail: VALID_THUMB(c.data.thumbnail) ? c.data.thumbnail : null,
            flair: c.data.link_flair_text ?? null,
            score: c.data.score ?? 0,
            comments: c.data.num_comments ?? 0,
            ageSeconds: c.data.created_utc
              ? Math.floor(Date.now() / 1000) - c.data.created_utc
              : 0,
          },
        ]
      : [],
  );

  if (cfg['extra-sort-by'] === 'engagement') {
    posts.sort(compareEngagement);
  }
  return { posts: posts.slice(0, limit) };
});
