import { releasesSchema } from '../../shared/widgets/feeds';
import { registerWidget, type WidgetFetchContext } from './registry';
import { fetchJson } from './http';
import type { Release } from '../../shared/widgets/payloads';

interface GitHubRelease {
  name?: string | null;
  tag_name?: string;
  html_url?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
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

const SOURCE_PREFIXES: Record<string, Release['source']> = {
  gitlab: 'gitlab',
  codeberg: 'codeberg',
  dockerhub: 'docker-hub',
  github: 'github',
};

/** glance repo forms: "owner/repo", "gitlab:x", "dockerhub:image[:tag]". */
function parseRepoString(input: string): { source: Release['source']; path: string; tag?: string } {
  const prefixed = /^([a-z-]+):(.+)$/.exec(input);
  if (prefixed && SOURCE_PREFIXES[prefixed[1]]) {
    const source = SOURCE_PREFIXES[prefixed[1]];
    let path = prefixed[2];
    let tag: string | undefined;
    if (source === 'docker-hub') {
      const tagSep = path.lastIndexOf(':');
      if (tagSep > 0) {
        tag = path.slice(tagSep + 1);
        path = path.slice(0, tagSep);
      }
      if (!path.includes('/')) path = `library/${path}`;
    }
    return { source, path, tag };
  }
  return { source: 'github', path: input };
}

function parseRepo(
  repo: string | { url?: string; repository?: string; source?: Release['source']; 'include-prereleases'?: boolean },
): { source: Release['source']; path: string; tag?: string; includePrereleases: boolean } {
  const includePrereleases =
    typeof repo === 'object' && repo['include-prereleases'] === true;
  if (typeof repo === 'string') {
    return { ...parseRepoString(repo), includePrereleases };
  }
  const url = repo.url ?? repo.repository ?? '';
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
    return { source, path, includePrereleases };
  }
  return { source: repo.source ?? 'github', path: url, includePrereleases };
}

interface RepoRequest {
  source: Release['source'];
  path: string;
  tag?: string;
  includePrereleases: boolean;
}

async function fetchReleases(
  ctx: WidgetFetchContext,
  req: RepoRequest,
  limit: number,
  token: string | undefined,
): Promise<Release[]> {
  const { source, path } = req;
  if (source === 'github') {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const data = await fetchJson<GitHubRelease[]>(
      ctx,
      `https://api.github.com/repos/${path}/releases?per_page=${limit}`,
      { headers },
    );
    // glance parity: the `/releases/latest` endpoint excludes prereleases
    // and drafts; the list endpoint returns both, so filter unless requested.
    const filtered = data.filter(
      (r) => req.includePrereleases || (!r.prerelease && !r.draft),
    );
    return filtered.map((r) => ({
      name: r.name || r.tag_name || '',
      tag: r.tag_name ?? '',
      url: r.html_url ?? `https://github.com/${path}/releases`,
      published: r.published_at ?? null,
      source,
    }));
  }
  if (source === 'docker-hub') {
    // a pinned tag needs to see past `limit` results, so widen the page
    const data = await fetchJson<DockerTags>(
      ctx,
      `https://hub.docker.com/v2/repositories/${path}/tags?page_size=${req.tag ? 100 : limit}`,
    );
    const results = (data.results ?? []).filter(
      (r) => !req.tag || r.name === req.tag,
    );
    return results.map((r) => ({
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
      const req = parseRepo(repo);
      const token =
        req.source === 'github' ? githubToken : cfg['gitlab-token'];
      return fetchReleases(ctx, req, limit, token);
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
