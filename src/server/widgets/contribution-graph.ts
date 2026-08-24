import {
  CONTRIBUTION_GRAPH_DEFAULTS,
  contributionGraphSchema,
} from '../../shared/widgets/contribution';
import type { ContributionDay, ContributionGraphData } from '../../shared/widgets/payloads';
import { fetchText } from './http';
import { registerWidget } from './registry';

const TAG = /<[a-z]+[^>]*?\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;

function levelFor(count: number, attr?: string): 0 | 1 | 2 | 3 | 4 {
  if (attr) return Math.min(4, Number(attr)) as 0 | 1 | 2 | 3 | 4;
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 7) return 2;
  if (count <= 12) return 3;
  return 4;
}

export function parseContributionDays(html: string): ContributionDay[] {
  const days: ContributionDay[] = [];
  for (const m of html.matchAll(TAG)) {
    const tag = m[0];
    const countMatch = /\bdata-count="(\d+)"/.exec(tag);
    const count = countMatch ? Number(countMatch[1]) : 0;
    const levelMatch = /\bdata-level="(\d)"/.exec(tag);
    days.push({ date: m[1], count, level: levelFor(count, levelMatch?.[1]) });
  }
  return days;
}

registerWidget('contribution-graph', async (ctx, config): Promise<ContributionGraphData> => {
  const cfg = contributionGraphSchema.parse(config);
  const url = `https://github.com/${encodeURIComponent(cfg.username)}`;
  // fetchWithRetry throws `HTTP <status> for <sanitized-url>` on failure
  const html = await fetchText(ctx, url, {
    headers: { Accept: 'text/html', 'User-Agent': 'glimpse/1.0' },
  });
  const days = parseContributionDays(html);
  if (days.length === 0) {
    throw new Error(`No contribution data for ${cfg.username} (profile may be private or missing calendar)`);
  }
  const weeks = cfg.limit ?? CONTRIBUTION_GRAPH_DEFAULTS.limit;
  return { username: cfg.username, days: days.slice(-weeks * 7) };
});
