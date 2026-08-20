import { hackerNewsSchema } from '../../shared/widgets/feeds';
import { registerWidget } from './registry';
import { fetchJson } from './http';
import type { HnPost } from '../../shared/widgets/payloads';

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

registerWidget('hacker-news', async (ctx, config) => {
  const cfg = hackerNewsSchema.parse(config);
  const sort = cfg['sort-by'] ?? 'top';
  const limit = cfg.limit ?? 5;

  const ids = await fetchJson<number[]>(
    ctx,
    `https://hacker-news.firebaseio.com/v0/${sort}stories.json`,
  );
  const wanted = Math.min(ids.length, Math.max(limit * 2, 30));
  const items = await Promise.all(
    ids.slice(0, wanted).map((id) =>
      fetchJson<HnItem | null>(
        ctx,
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      ),
    ),
  );

  let posts: HnPost[] = items
    .filter((i): i is HnItem => i !== null && typeof i.title === 'string')
    .map((i) => ({
      id: i.id,
      title: i.title as string,
      url: i.url ?? `https://news.ycombinator.com/item?id=${i.id}`,
      commentsUrl:
        cfg['comments-url-template']?.replace('{ID}', String(i.id)) ??
        `https://news.ycombinator.com/item?id=${i.id}`,
      score: i.score ?? 0,
      comments: i.descendants ?? 0,
      ageSeconds: i.time ? Math.floor(Date.now() / 1000) - i.time : 0,
    }));

  if (cfg['extra-sort-by'] === 'engagement') {
    posts.sort((a, b) => b.score + b.comments - (a.score + a.comments));
  }
  return { posts: posts.slice(0, limit) };
});
