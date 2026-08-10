import { releasesSchema } from '../../shared/widgets/feeds';
import { registerWidget, type WidgetFetchContext } from './registry';
import { fetchJson } from './http';

export interface Release {
  name: string;
  tag: string;
  url: string;
  published: string | null;
  source: 'github' | 'gitlab' | 'codeberg' | 'docker-hub';
}

interface GitHubRelease {
  name?: string | null;
  tag_name?: string;
  html_url?: string;
  published_at?: string;
}

interface GitLabRelease {
  name?: string | null;
  tag_name?: string;
  _links?: { self?: string };
  released_at?: string;
}

interface DockerTag {
  name?: string;
  last_updated?: string;
}

interface DockerTags {
  results?: DockerTag[];
}

function parseRepo(
  repo: { url?: string; source?: 'github' | 'gitlab' | 'codeberg' | 'docker-hub' },
): { source: 'github' | 'gitlab' | 'codeberg' | 'docker-hub'; path: string } {
  const url = repo.url ?? '';
  const m = /^https?:\/\/([^/]+)\/(.+?)\/?$/.exec(url);
  if (m) {
    const host = m[1];
    const source =
      host.includes('github') ? 'github'
      : host.includes('gitlab') ? 'gitlab'
      : host.includes('codeberg') ? 'codeberg'
      : host.includes('docker') ? 'docker-hub'
      : (repo.source ?? 'github');
    const path = source === 'docker-hub' && m[2].startsWith('r/') ? m[2].slice(2) : m[2];
    return { source, path };
  }
  return { source: repo.source ?? 'github', path: url };
}

async function fetchReleases(
  ctx: WidgetFetchContext,
  source: Release['source'],
  path: string,
  limit: number,
  token: string | undefined,
): Promise<Release[]> {
  if (source === 'github') {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const data = await fetchJson<GitHubRelease[]>(
      ctx,
      `https://api.github.com/repos/${path}/releases?per_page=${limit}`,
      { headers },
    );
    return data.map((r) => ({
      name: r.name || r.tag_name || '',
      tag: r.tag_name ?? '',
      url: r.html_url ?? `https://github.com/${path}/releases`,
      published: r.published_at ?? null,
      source,
    }));
  }
  if (source === 'docker-hub') {
    const data = await fetchJson<DockerTags>(
      ctx,
      `https://hub.docker.com/v2/repositories/${path}/tags?page_size=${limit}`,
    );
    return (data.results ?? []).map((r) => ({
      name: r.name ?? '',
      tag: r.name ?? '',
      url: `https://hub.docker.com/r/${path}/tags`,
      published: r.last_updated ?? null,
      source,
    }));
  }
  // gitlab / codeberg share the GitLab API shape
  const host = source === 'codeberg' ? 'codeberg.org' : 'gitlab.com';
  const project = encodeURIComponent(path);
  const data = await fetchJson<GitLabRelease[]>(
    ctx,
    `https://${host}/api/v4/projects/${project}/releases?per_page=${limit}`,
    { headers: token ? { 'PRIVATE-TOKEN': token } : undefined },
  );
  return data.map((r) => ({
    name: r.name || r.tag_name || '',
    tag: r.tag_name ?? '',
    url: r._links?.self ?? `https://${host}/${path}/-/releases`,
    published: r.released_at ?? null,
    source,
  }));
}

registerWidget('releases', async (ctx, config) => {
  const cfg = releasesSchema.parse(config);
  const limit = cfg.limit ?? 10;
  const githubToken = cfg.token ?? ctx.env.GITHUB_TOKEN;

  const settled = await Promise.allSettled(
    cfg.repositories.map((repo) => {
      const { source, path } = parseRepo(repo);
      const token = source === 'github' ? githubToken : cfg['gitlab-token'];
      return fetchReleases(ctx, source, path, limit, token);
    }),
  );
  const failed = settled.filter((r) => r.status === 'rejected');
  if (failed.length === cfg.repositories.length) {
    throw new Error('all release sources failed to load');
  }
  const releases: Release[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') releases.push(...r.value);
  }
  releases.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });
  return { releases: releases.slice(0, limit) };
});
