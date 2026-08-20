import { redditSchema } from '../../shared/widgets/feeds';
import { parseCacheDuration } from '../cache';
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

const USER_AGENT = 'glimpse/0.1 (dashboard) by /u/glimpse-app';

interface ProxyConfig {
  url: string;
  'allow-insecure'?: boolean;
  timeout?: string;
}

/** Reddit app-only OAuth: token cached for ~1h (Reddit tokens live 24h). */
async function getAccessToken(
  ctx: WidgetFetchContext,
  appAuth: { id: string; secret: string },
): Promise<string> {
  const cached = ctx.cache.get<string>('reddit:token');
  if (cached) return cached;

  const res = await ctx.fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${appAuth.id}:${appAuth.secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`reddit token: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('reddit token: no access_token in response');

  const ttl = Math.min((body.expires_in ?? 3600) * 1000, 3600_000);
  ctx.cache.set('reddit:token', body.access_token, ttl);
  return body.access_token;
}

registerWidget('reddit', async (ctx, config) => {
  const cfg = redditSchema.parse(config);
  const limit = cfg.limit ?? 10;
  const sort = cfg['sort-by'] ?? 'hot';
  const period = cfg['top-period'] ?? 'day';

  const proxy: ProxyConfig | undefined =
    typeof cfg.proxy === 'string' ? { url: cfg.proxy } : cfg.proxy;
  if (proxy && proxy.url.startsWith('http://') && !proxy['allow-insecure']) {
    throw new Error(
      `reddit: insecure proxy "${proxy.url}" requires allow-insecure: true`,
    );
  }

  let url = cfg.search
    ? `https://www.reddit.com/search.json?q=${encodeURIComponent(cfg.search)}&sort=${sort}&t=${period}&limit=${limit}`
    : `https://www.reddit.com/r/${encodeURIComponent(cfg.subreddit)}/${sort}.json?limit=${limit}&t=${period}`;
  if (cfg['request-url-template']) {
    url = cfg['request-url-template'].replace('{REQUEST-URL}', url);
  }

  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cfg['app-auth']) {
    headers.Authorization = `Bearer ${await getAccessToken(ctx, cfg['app-auth'])}`;
  }

  const res = await ctx.fetch(url, {
    headers,
    signal: AbortSignal.timeout(proxy?.timeout ? parseCacheDuration(proxy.timeout) : 15_000),
    ...(proxy ? { proxy: proxy.url } : {}),
  } as unknown as RequestInit & { proxy?: string });
  if (!res.ok) {
    const hint =
      res.status === 403 && !cfg['app-auth']
        ? ' — anonymous Reddit JSON is now blocked (403); add reddit.app-auth id/secret or a proxy/request-url-template to fetch via OAuth'
        : '';
    throw new Error(`HTTP ${res.status} for ${url}${hint}`);
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
    posts.sort((a, b) => b.score + b.comments - (a.score + a.comments));
  }
  return { posts: posts.slice(0, limit) };
});
