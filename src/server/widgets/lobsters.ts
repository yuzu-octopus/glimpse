import { lobstersSchema } from '../../shared/widgets/keyed';
import { fetchJson } from './http';
import { registerWidget } from './registry';
import type { LobsterPost } from '../../shared/widgets/payloads';

interface LobstersStory {
  id?: number;
  title?: string;
  url?: string;
  comments_url?: string;
  score?: number;
  comment_count?: number;
  created_at?: string;
  tags?: string[];
}

registerWidget('lobsters', async (ctx, config) => {
  const cfg = lobstersSchema.parse(config);
  const feedUrl =
    cfg['custom-url'] ??
    `${cfg['instance-url'] ?? 'https://lobste.rs'}/${cfg['sort-by'] === 'new' ? 'newest' : 'hottest'}.json`;
  const stories = await fetchJson<LobstersStory[]>(ctx, feedUrl);

  const tags = cfg.tags;
  const tagSet = new Set(tags ?? []);
  const filtered =
    tags && tags.length > 0
      ? stories.filter((s) => (s.tags ?? []).some((t) => tagSet.has(t)))
      : stories;

  const limit = cfg.limit ?? 5;
  const posts: LobsterPost[] = filtered.slice(0, limit).map((s) => {
    const created = Date.parse(s.created_at ?? '');
    return {
      id: s.id ?? 0,
      title: s.title ?? '',
      url: s.url ?? '',
      commentsUrl: s.comments_url ?? '',
      score: s.score ?? 0,
      comments: s.comment_count ?? 0,
      ageSeconds: Number.isNaN(created) ? 0 : Math.max(0, Math.floor((Date.now() - created) / 1000)),
      tags: s.tags ?? [],
    };
  });
  return { posts };
});
