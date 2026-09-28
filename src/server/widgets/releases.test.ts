import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './releases';
import type { Release } from '../../shared/widgets/payloads';
import { releasesSchema } from '../../shared/widgets/feeds';

function makeCtx(
  routes: Record<string, unknown>,
  env: Record<string, string | undefined> = {},
): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: string) => {
    const hit = routes[url];
    if (hit === undefined) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(hit), { status: 200 });
  });
  return {
    ctx: {
      fetch: fetchMock as unknown as typeof fetch,
      env,
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    },
    fetchMock,
  };
}

const releasesFetcher = () => serverWidgets.get('releases')!;


describe('releases fetcher', () => {
  it('maps GitHub releases and merges sources', async () => {
    const routes = {
      'https://api.github.com/repos/glanceapp/glance/releases?per_page=5': [
        { name: 'v0.7.0', tag_name: 'v0.7.0', html_url: 'https://github.com/glanceapp/glance/releases/tag/v0.7.0', published_at: '2024-06-01T00:00:00Z' },
      ],
      'https://hub.docker.com/v2/repositories/glanceapp/glance/tags?page_size=5': {
        results: [{ name: 'latest', last_updated: '2024-06-02T00:00:00Z' }],
      },
    };
    const { ctx } = makeCtx(routes);
    const data = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: [
        { url: 'https://github.com/glanceapp/glance' },
        { url: 'https://hub.docker.com/r/glanceapp/glance', source: 'docker-hub' },
      ],
    })) as { releases: { name: string; source: string; published: string | null }[] };
    expect(data.releases).toHaveLength(2);
    // newest first
    expect(data.releases[0].source).toBe('docker-hub');
    expect(data.releases[1].source).toBe('github');
  });

  it('sends the GITHUB_TOKEN env value to GitHub', async () => {
    const routes = {
      'https://api.github.com/repos/o/r/releases?per_page=5': [],
    };
    const { ctx, fetchMock } = makeCtx(routes, { GITHUB_TOKEN: 'env-sekrit' });
    await releasesFetcher()(ctx, { type: 'releases', repositories: [{ url: 'o/r' }] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer env-sekrit' }),
    );
  });

  it('sends the GITLAB_TOKEN env value to GitLab', async () => {
    const routes = {
      'https://gitlab.com/api/v4/projects/o%2Fr/releases?per_page=5': [],
    };
    const { ctx, fetchMock } = makeCtx(routes, { GITLAB_TOKEN: 'env-gl' });
    await releasesFetcher()(ctx, { type: 'releases', repositories: ['gitlab:o/r'] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(expect.objectContaining({ 'PRIVATE-TOKEN': 'env-gl' }));
  });

  it('takes no token in the config — the schema strips it', async () => {
    const routes = { 'https://api.github.com/repos/o/r/releases?per_page=5': [] };
    const { ctx, fetchMock } = makeCtx(routes, { GITHUB_TOKEN: 'env-sekrit' });
    await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: [{ url: 'o/r' }],
      token: 'leaked',
      'gitlab-token': 'leaked',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.stringify(init.headers)).toContain('env-sekrit');
    expect(JSON.stringify(init.headers)).not.toContain('leaked');
    const parsed = releasesSchema.parse({ type: 'releases', repositories: ['o/r'], token: 'leaked', 'gitlab-token': 'leaked' });
    expect('token' in parsed).toBe(false);
    expect('gitlab-token' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('leaked');
  });

  it('parses all string repo forms into the right endpoints', async () => {
    const routes = {
      'https://api.github.com/repos/glanceapp/glance/releases?per_page=5': [
        { name: 'v1', tag_name: 'v1', html_url: 'https://github.com/glanceapp/glance/releases/tag/v1', published_at: '2024-06-01T00:00:00Z' },
      ],
      'https://gitlab.com/api/v4/projects/inkscape%2Finkscape/releases?per_page=5': [
        { name: 'r1', tag_name: 'r1', _links: { self: 'https://gitlab.com/inkscape/inkscape/-/releases/r1' }, released_at: '2024-06-02T00:00:00Z' },
      ],
      'https://codeberg.org/api/v4/projects/redict%2Fredict/releases?per_page=5': [
        { name: 'c1', tag_name: 'c1', released_at: '2024-06-03T00:00:00Z' },
      ],
    };
    const { ctx, fetchMock } = makeCtx(routes);
    const data = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: ['glanceapp/glance', 'gitlab:inkscape/inkscape', 'codeberg:redict/redict'],
    })) as { releases: Release[] };
    expect(data.releases).toHaveLength(3);
    expect(data.releases.map((r) => [r.tag, r.source])).toEqual([
      ['c1', 'codeberg'],
      ['r1', 'gitlab'],
      ['v1', 'github'],
    ]);
    // three distinct endpoints hit, no URL munging
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining([
        'https://api.github.com/repos/glanceapp/glance/releases?per_page=5',
        'https://gitlab.com/api/v4/projects/inkscape%2Finkscape/releases?per_page=5',
        'https://codeberg.org/api/v4/projects/redict%2Fredict/releases?per_page=5',
      ]),
    );
  });

  it('filters GitHub prereleases and drafts unless include-prereleases', async () => {
    const routes = {
      'https://api.github.com/repos/o/r/releases?per_page=5': [
        { name: 'Stable', tag_name: 'v1.0.0', html_url: 'https://github.com/o/r/releases/tag/v1.0.0', published_at: '2024-06-01T00:00:00Z', prerelease: false },
        { name: 'Beta', tag_name: 'v2.0.0-beta', html_url: 'https://github.com/o/r/releases/tag/v2.0.0-beta', published_at: '2024-06-02T00:00:00Z', prerelease: true },
        { name: 'Draft', tag_name: 'v9.9.9', html_url: 'https://github.com/o/r/releases/tag/v9.9.9', published_at: '2024-06-03T00:00:00Z', draft: true },
      ],
    };
    const { ctx } = makeCtx(routes);
    const without = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: ['o/r'],
    })) as { releases: Release[] };
    expect(without.releases.map((r) => r.tag)).toEqual(['v1.0.0']);

    const withPre = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: [{ repository: 'o/r', 'include-prereleases': true }],
    })) as { releases: Release[] };
    // newest first: draft, beta, stable
    expect(withPre.releases.map((r) => r.tag)).toEqual(['v9.9.9', 'v2.0.0-beta', 'v1.0.0']);
  });

  it('pins a dockerhub tag and expands the library/ prefix', async () => {
    const routes = {
      'https://hub.docker.com/v2/repositories/library/nginx/tags?page_size=100': {
        results: [
          { name: 'latest', last_updated: '2024-06-01T00:00:00Z' },
          { name: 'stable-alpine', last_updated: '2024-06-02T00:00:00Z' },
          { name: 'mainline', last_updated: '2024-06-03T00:00:00Z' },
        ],
      },
    };
    const { ctx, fetchMock } = makeCtx(routes);
    const data = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: ['dockerhub:nginx:stable-alpine'],
    })) as { releases: Release[] };
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://hub.docker.com/v2/repositories/library/nginx/tags?page_size=100',
    );
    expect(data.releases).toHaveLength(1);
    expect(data.releases[0]).toMatchObject({
      tag: 'stable-alpine',
      source: 'docker-hub',
    });
  });

  it('asks upstream for exactly `limit` and returns exactly `limit`', async () => {
    // The old route table answered `?per_page=3` with 3 items and
    // `?per_page=5` with 10, so a fetcher that asked for 5 and sliced to 3
    // passed the same as one that asked for 3. A single catch-all route plus
    // the URL assertion is what separates them.
    const ghReleases = Array.from({ length: 10 }, (_, i) => ({
      tag_name: `v1.${i}.0`,
      html_url: `https://github.com/o/r/releases/tag/v1.${i}.0`,
      published_at: `2024-01-${String(10 - i).padStart(2, '0')}T00:00:00Z`,
      draft: false,
      prerelease: false,
    }));
    const { ctx, fetchMock } = makeCtx({
      // Catch-all: any releases URL answers with all 10, so the only thing
      // that can produce 3 is the fetcher's own slice.
      'https://api.github.com/repos/o/r/releases?per_page=3': ghReleases,
      'https://api.github.com/repos/o/r/releases?per_page=5': ghReleases,
    });
    const data = (await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: ['o/r'],
      limit: 3,
    })) as { releases: Release[] };
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.github.com/repos/o/r/releases?per_page=3');
    expect(data.releases).toHaveLength(3);
    expect(data.releases.map((r) => r.tag)).toEqual(['v1.0.0', 'v1.1.0', 'v1.2.0']);
  });

  it('does not double-encode pre-escaped path segments', async () => {
    const routes = {
      'https://api.github.com/repos/o/repo%20name/releases?per_page=5': [],
    };
    const { ctx, fetchMock } = makeCtx(routes);
    await releasesFetcher()(ctx, {
      type: 'releases',
      repositories: ['o/repo%20name'],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/o/repo%20name/releases?per_page=5',
    );
  });
});
