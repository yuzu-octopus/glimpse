import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './repository';
import type { RepositoryData } from '../../shared/widgets/payloads';

const REPO = {
  full_name: 'acme/widget',
  description: 'A widget',
  stargazers_count: 123,
  html_url: 'https://github.com/acme/widget',
};

const PULLS = [
  { number: 11, title: 'PR one', html_url: 'https://github.com/acme/widget/pull/11' },
];

const ISSUES = [
  { number: 5, title: 'Issue five', html_url: 'https://github.com/acme/widget/issues/5' },
  {
    number: 6,
    title: 'PR disguised as issue',
    html_url: 'https://github.com/acme/widget/pull/6',
    pull_request: { url: 'https://api.github.com/repos/acme/widget/pulls/6' },
  },
];

function makeCtx(routes: Record<string, unknown>, env: Record<string, string | undefined> = {}): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: string) => {
    const hit = routes[url];
    if (hit === undefined) return new Response('{"error":"not found"}', { status: 404 });
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

const PULLS_URL = 'https://api.github.com/repos/acme/widget/pulls?state=open&per_page=5';
const ISSUES_URL = 'https://api.github.com/repos/acme/widget/issues?state=open&per_page=5';
const REPO_URL = 'https://api.github.com/repos/acme/widget';

const repositoryFetcher = () => serverWidgets.get('repository')!;

describe('repository fetcher', () => {
  it('maps repo, pulls and issues excluding pull_request entries', async () => {
    const { ctx } = makeCtx({
      [REPO_URL]: REPO,
      [PULLS_URL]: PULLS,
      [ISSUES_URL]: ISSUES,
    });
    const data = (await repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/widget' })) as RepositoryData;
    expect(data.name).toBe('acme/widget');
    expect(data.description).toBe('A widget');
    expect(data.stars).toBe(123);
    expect(data.pulls).toEqual([
      { number: 11, title: 'PR one', url: 'https://github.com/acme/widget/pull/11' },
    ]);
    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].number).toBe(5);
  });

  it('uses GITHUB_TOKEN from env as Bearer auth', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const hit = url === REPO_URL ? REPO : url === PULLS_URL ? PULLS : ISSUES;
      return new Response(JSON.stringify(hit), { status: 200 });
    });
    const ctx: WidgetFetchContext = {
      fetch: fetchMock as unknown as typeof fetch,
      env: { GITHUB_TOKEN: 'secret-token' },
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    await repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/widget' });
    for (const call of fetchMock.mock.calls) {
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer secret-token');
    }
  });

  it('throws on missing repo (404)', async () => {
    const { ctx } = makeCtx({});
    await expect(
      repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/missing' }),
    ).rejects.toThrow();
  });
});
