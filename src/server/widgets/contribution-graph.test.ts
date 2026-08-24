import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import { parseContributionDays } from './contribution-graph';
import './contribution-graph';
import type { ContributionGraphData } from '../../shared/widgets/payloads';

const FIXTURE = `<div class="ContributionCalendar">
<table><tr>
<td class="ContributionCalendar-cell" data-date="2024-01-01" data-level="0" data-count="0" tabindex="-1" role="gridcell"></td>
<td data-count="3" data-level="1" data-date="2024-01-02"></td>
<td data-level="4" data-date="2024-01-03" data-count="15"></td>
</tr></table>
</div>`;

function makeCtx(html: string, status = 200): { ctx: WidgetFetchContext; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async () => new Response(html, { status }));
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

const fetcher = () => serverWidgets.get('contribution-graph')!;

describe('contribution-graph parser', () => {
  it('parses days regardless of attribute order', () => {
    expect(parseContributionDays(FIXTURE)).toEqual([
      { date: '2024-01-01', count: 0, level: 0 },
      { date: '2024-01-02', count: 3, level: 1 },
      { date: '2024-01-03', count: 15, level: 4 },
    ]);
  });

  it('derives level from count when data-level is absent', () => {
    expect(parseContributionDays('<rect data-date="2024-02-01" data-count="7"/>')[0].level).toBe(2);
    expect(parseContributionDays('<rect data-date="2024-02-01" data-count="12"/>')[0].level).toBe(3);
    expect(parseContributionDays('<rect data-date="2024-02-01" data-count="0"/>')[0].level).toBe(0);
    expect(parseContributionDays('<rect data-date="2024-02-01" data-count="30"/>')[0].level).toBe(4);
  });

  it('ignores elements without data-date', () => {
    expect(parseContributionDays('<td class="cell"/><span data-count="9"/>')).toEqual([]);
  });
});

describe('contribution-graph fetcher', () => {
  it('fetches profile HTML and returns days', async () => {
    const { ctx, fetchMock } = makeCtx(FIXTURE);
    const data = (await fetcher()(ctx, { type: 'contribution-graph', username: 'octocat' })) as ContributionGraphData;
    expect(data.username).toBe('octocat');
    expect(data.days).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://github.com/octocat');
    expect((init.headers as Record<string, string>).Accept).toBe('text/html');
  });

  it('limits to the last N weeks (7 days each)', async () => {
    let html = '';
    for (let d = 1; d <= 21; d++) {
      html += `<td data-date="2024-03-${String(d).padStart(2, '0')}" data-count="${d}"/>`;
    }
    const { ctx } = makeCtx(html);
    const data = (await fetcher()(ctx, { type: 'contribution-graph', username: 'octocat', limit: 2 })) as ContributionGraphData;
    expect(data.days).toHaveLength(14);
    expect(data.days[0].date).toBe('2024-03-08');
    expect(data.days.at(-1)?.date).toBe('2024-03-21');
  });

  it('throws a sanitized error on 404', async () => {
    const { ctx } = makeCtx('Not Found', 404);
    await expect(
      fetcher()(ctx, { type: 'contribution-graph', username: 'missing-user' }),
    ).rejects.toThrow(/HTTP 404 for https:\/\/github\.com\/missing-user$/);
  });

  it('throws when the page has no calendar cells', async () => {
    const { ctx } = makeCtx('<html><body>No calendar here</body></html>');
    await expect(
      fetcher()(ctx, { type: 'contribution-graph', username: 'octocat' }),
    ).rejects.toThrow(/No contribution data/);
  });
});

describe('schema defaults', () => {
  it('defaults limit to 52 weeks', async () => {
    const html = Array.from({ length: 400 }, (_, i) => {
      const date = new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10);
      return `<td data-date="${date}" data-count="${i}"/>`;
    }).join('');
    const { ctx } = makeCtx(html);
    const data = (await fetcher()(ctx, { type: 'contribution-graph', username: 'octocat' })) as ContributionGraphData;
    expect(data.days.at(-1)?.date).toBe('2024-02-04');
  });
});
