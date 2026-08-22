import { REPOSITORY_DEFAULTS, repositorySchema } from '../../shared/widgets/keyed';
import { fetchJson } from './http';
import { registerWidget } from './registry';
import type { RepoPull } from '../../shared/widgets/payloads';

interface GitHubRepo {
  full_name?: string;
  description?: string | null;
  stargazers_count?: number;
  html_url?: string;
}

interface GitHubIssueLike {
  number?: number;
  title?: string;
  html_url?: string;
  pull_request?: unknown;
}

function mapIssue(p: GitHubIssueLike): RepoPull {
  return {
    number: p.number ?? 0,
    title: p.title ?? '',
    url: p.html_url ?? '',
  };
}

registerWidget('repository', async (ctx, config) => {
  const cfg = repositorySchema.parse(config);
  const base = `https://api.github.com/repos/${cfg.repository}`;
  const token = cfg.token ?? ctx.env.GITHUB_TOKEN;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [repo, pulls, issues] = await Promise.all([
    fetchJson<GitHubRepo>(ctx, base, { headers }),
    fetchJson<GitHubIssueLike[]>(
      ctx,
      `${base}/pulls?state=open&per_page=${cfg['pull-requests-limit'] ?? REPOSITORY_DEFAULTS['pull-requests-limit']}`,
      { headers },
    ),
    fetchJson<GitHubIssueLike[]>(
      ctx,
      `${base}/issues?state=open&per_page=${cfg['issues-limit'] ?? REPOSITORY_DEFAULTS['issues-limit']}`,
      { headers },
    ),
  ]);

  return {
    name: repo.full_name ?? cfg.repository,
    description: repo.description ?? null,
    stars: repo.stargazers_count ?? null,
    url: repo.html_url ?? `https://github.com/${cfg.repository}`,
    pulls: pulls.map(mapIssue),
    issues: issues.flatMap((i) => ('pull_request' in i ? [] : [mapIssue(i)])),
  };
});
