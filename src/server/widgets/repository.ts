import { repositorySchema } from '../../shared/widgets/keyed';
import { fetchJson } from './http';
import { registerWidget } from './registry';

export interface RepoPull {
  number: number;
  title: string;
  url: string;
}

export interface RepositoryData {
  name: string;
  description: string | null;
  stars: number | null;
  url: string;
  pulls: RepoPull[];
  issues: RepoPull[];
}

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

  const repo = await fetchJson<GitHubRepo>(ctx, base, { headers });
  const pulls = await fetchJson<GitHubIssueLike[]>(
    ctx,
    `${base}/pulls?state=open&per_page=${cfg['pull-requests-limit'] ?? 3}`,
    { headers },
  );
  const issuesRes = await fetchJson<GitHubIssueLike[]>(
    ctx,
    `${base}/issues?state=open&per_page=${cfg['issues-limit'] ?? 3}`,
    { headers },
  );

  // v1 does not display commits; the option stays accepted (fetched when >= 0).
  if ((cfg['commits-limit'] ?? -1) >= 0) {
    await fetchJson<unknown[]>(
      ctx,
      `${base}/commits?per_page=${cfg['commits-limit']}`,
      { headers },
    );
  }

  return {
    name: repo.full_name ?? cfg.repository,
    description: repo.description ?? null,
    stars: repo.stargazers_count ?? null,
    url: repo.html_url ?? `https://github.com/${cfg.repository}`,
    pulls: pulls.map(mapIssue),
    issues: issuesRes.filter((i) => !('pull_request' in i)).map(mapIssue),
  } as RepositoryData;
});
