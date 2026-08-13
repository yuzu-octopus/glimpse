import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './releases';
import type { Release } from '../../shared/widgets/payloads';

function makeCtx(routes: Record<string, unknown>): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: string) => {
    const hit = routes[url];
    if (hit === undefined) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(hit), { status: 200 });
  });
  return {
    ctx: {
      fetch: fetchMock as unknown as typeof fetch,
      env: {},
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
      'https://api.github.com/repos/glanceapp/glance/releases?per_page=10': [
        { name: 'v0.7.0', tag_name: 'v0.7.0', html_url: 'https://github.com/glanceapp/glance/releases/tag/v0.7.0', published_at: '2024-06-01T00:00:00Z' },
      ],
      'https://hub.docker.com/v2/repositories/glanceapp/glance/tags?page_size=10': {
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

  it('sends the token to GitHub when configured', async () => {
    const routes = {
      'https://api.github.com/repos/o/r/releases?per_page=10': [],
    };
    const { ctx, fetchMock } = makeCtx(routes);
    await releasesFetcher()(ctx, { type: 'releases', repositories: [{ url: 'o/r' }], token: 'sekrit' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ Authorization: 'Bearer sekrit' });
  });

  it('parses all string repo forms into the right endpoints', async () => {
    const routes = {
      'https://api.github.com/repos/glanceapp/glance/releases?per_page=10': [
        { name: 'v1', tag_name: 'v1', html_url: 'https://github.com/glanceapp/glance/releases/tag/v1', published_at: '2024-06-01T00:00:00Z' },
      ],
      'https://gitlab.com/api/v4/projects/inkscape%2Finkscape/releases?per_page=10': [
        { name: 'r1', tag_name: 'r1', _links: { self: 'https://gitlab.com/inkscape/inkscape/-/releases/r1' }, released_at: '2024-06-02T00:00:00Z' },
      ],
      'https://codeberg.org/api/v4/projects/redict%2Fredict/releases?per_page=10': [
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
        'https://api.github.com/repos/glanceapp/glance/releases?per_page=10',
        'https://gitlab.com/api/v4/projects/inkscape%2Finkscape/releases?per_page=10',
        'https://codeberg.org/api/v4/projects/redict%2Fredict/releases?per_page=10',
      ]),
    );
  });

  it('filters GitHub prereleases and drafts unless include-prereleases', async () => {
    const routes = {
      'https://api.github.com/repos/o/r/releases?per_page=10': [
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
});
