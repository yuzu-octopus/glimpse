import { HACKER_NEWS_DEFAULTS, hackerNewsSchema } from '../../shared/widgets/feeds';
import { registerWidget } from './registry';
import { fetchJson } from './http';
import { compareEngagement } from './engagement';
import { widgetLimit } from './runtime';
import type { HnPost } from '../../shared/widgets/payloads';

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };
  return <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) {
      const { promise, resolve } = Promise.withResolvers<void>();
      queue.push(() => resolve());
      return promise.then(() => run(fn));
    }
    return run(fn);
  };
  function run<T>(fn: () => Promise<T>): Promise<T> {
    active++;
    return fn().finally(next);
  }
}

registerWidget('hacker-news', async (ctx, config) => {
  const cfg = hackerNewsSchema.parse(config);
  const sort = cfg['sort-by'] ?? 'top';
  const limit = widgetLimit(cfg, HACKER_NEWS_DEFAULTS.limit);

  const ids = await fetchJson<number[]>(
    ctx,
    `https://hacker-news.firebaseio.com/v0/${sort}stories.json`,
  );
  const wanted = Math.min(ids.length, Math.max(limit * 2, 30));
  const limit6 = pLimit(6);
  const settled = await Promise.allSettled(
    ids.slice(0, wanted).map((id) =>
      limit6(() =>
        ctx.singleflight.run(`hn:item:${id}`, () =>
          fetchJson<HnItem | null>(ctx, `https://hacker-news.firebaseio.com/v0/item/${id}.json`),
        ),
      ),
    ),
  );
  const items: (HnItem | null)[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') items.push((r as PromiseFulfilledResult<HnItem | null>).value);
  }

  const posts: HnPost[] = [];
  for (const i of items) {
    if (i !== null && typeof i.title === 'string') {
      posts.push({
        id: i.id,
        title: i.title as string,
        url: i.url ?? `https://news.ycombinator.com/item?id=${i.id}`,
        commentsUrl:
          cfg['comments-url-template']?.replace('{ID}', String(i.id)) ??
          `https://news.ycombinator.com/item?id=${i.id}`,
        score: i.score ?? 0,
        comments: i.descendants ?? 0,
        ageSeconds: i.time ? Math.floor(Date.now() / 1000) - i.time : 0,
      });
    }
  }
  if (cfg['extra-sort-by'] === 'engagement') {
    posts.sort(compareEngagement);
  }
  return { posts: posts.slice(0, limit) };
});
