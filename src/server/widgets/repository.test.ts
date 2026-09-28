import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './repository';
import type { RepositoryData } from '../../shared/widgets/payloads';
import { repositorySchema } from '../../shared/widgets/keyed';

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

  it('asks for commits only when commits-limit is above glance\'s -1 default', async () => {
    const { ctx, fetchMock } = makeCtx({
      [REPO_URL]: REPO,
      [PULLS_URL]: PULLS,
      [ISSUES_URL]: ISSUES,
    });
    const off = (await repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/widget' })) as RepositoryData;
    expect(off.commits).toEqual([]);
    expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain(`${REPO_URL}/commits?per_page=3`);

    const { ctx: ctx2, fetchMock: fetchMock2 } = makeCtx({
      [REPO_URL]: REPO,
      [PULLS_URL]: PULLS,
      [ISSUES_URL]: ISSUES,
      [`${REPO_URL}/commits?per_page=3`]: [
        {
          sha: 'abcdef1234567890',
          html_url: 'https://github.com/acme/widget/commit/abcdef1',
          commit: {
            message: 'Fix the thing\n\nA long body that must not show.',
            author: { name: 'Robin', date: '2024-01-01T10:00:00Z' },
          },
        },
      ],
    });
    const on = (await repositoryFetcher()(ctx2, {
      type: 'repository',
      repository: 'acme/widget',
      'commits-limit': 3,
    })) as RepositoryData;
    expect(on.commits).toEqual([
      {
        sha: 'abcdef1',
        message: 'Fix the thing',
        author: 'Robin',
        date: '2024-01-01T10:00:00Z',
        url: 'https://github.com/acme/widget/commit/abcdef1',
      },
    ]);
    expect(fetchMock2.mock.calls.map((c) => c[0])).toContain(`${REPO_URL}/commits?per_page=3`);
  });

  it('throws a sanitized message on missing repo (404)', async () => {
    // The contract is `HTTP ${status} for ${sanitizeUrl(url)}` — the message
    // reaches payload.error in the browser, so a bare toThrow would pass on
    // any rejection at all.
    const { ctx } = makeCtx({});
    await expect(
      repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/missing' }),
    ).rejects.toThrow('HTTP 404 for https://api.github.com/repos/acme/missing');
  });

  it('takes no token — the config value is stripped, GITHUB_TOKEN wins', async () => {
    const { ctx, fetchMock } = makeCtx(
      { [REPO_URL]: REPO, [PULLS_URL]: PULLS, [ISSUES_URL]: ISSUES },
      { GITHUB_TOKEN: 'env-token' },
    );
    await repositoryFetcher()(ctx, { type: 'repository', repository: 'acme/widget', token: 'leaked' });
    for (const call of fetchMock.mock.calls) {
      expect(JSON.stringify(call[1]?.headers)).toContain('Bearer env-token');
      expect(JSON.stringify(call[1]?.headers)).not.toContain('leaked');
    }
    const parsed = repositorySchema.parse({ type: 'repository', repository: 'acme/widget', token: 'leaked' });
    expect('token' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('leaked');
  });
});
