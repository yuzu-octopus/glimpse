import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './releases';

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
});
