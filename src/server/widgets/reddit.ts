import { redditSchema } from '../../shared/widgets/feeds';
import { registerWidget } from './registry';
import { fetchJson } from './http';

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

export interface RedditPost {
  title: string;
  url: string;
  commentsUrl: string;
  thumbnail: string | null;
  flair: string | null;
  score: number;
  comments: number;
  ageSeconds: number;
}

const VALID_THUMB = (t: string | undefined): t is string =>
  typeof t === 'string' && t.startsWith('http');

registerWidget('reddit', async (ctx, config) => {
  const cfg = redditSchema.parse(config);
  const limit = cfg.limit ?? 10;
  const sort = cfg['sort-by'] ?? 'hot';
  const period = cfg['top-period'] ?? 'day';

  const url = cfg.search
    ? `https://www.reddit.com/search.json?q=${encodeURIComponent(cfg.search)}&sort=${sort}&t=${period}&limit=${limit}`
    : `https://www.reddit.com/r/${encodeURIComponent(cfg.subreddit)}/${sort}.json?limit=${limit}&t=${period}`;

  const listing = await fetchJson<RedditListing>(ctx, url, {
    headers: { 'User-Agent': 'glimpse/0.1 (dashboard) by /u/glimpse-app' },
  });

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

  return { posts: posts.slice(0, limit) };
});
