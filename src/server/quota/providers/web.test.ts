import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../../cache';
import { fetchTableRow, tableRow } from './providerTable';

function ctxWith(handler: (url: string, init?: RequestInit) => Response) {
  const f = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  return { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight(), f } as const;
}

describe('web providers', () => {
  it('Cursor sends Cookie + CSRF and maps usage', async () => {
    const { f, ...ctx } = ctxWith((_url, init) => {
      expect((init?.headers as Record<string, string>).Cookie).toContain('WorkosCursorSessionToken');
      return new Response(JSON.stringify({ usage: { usedPercent: 40, resetAt: Date.now() + 3_600_000 } }), { status: 200 });
    });
    const snap = await fetchTableRow(tableRow('cursor'), { token: 'WorkosCursorSessionToken=abc; csrftoken=xyz' }, ctx as never);
    expect(snap.provider).toBe('cursor');
    expect(snap.windows[0].usedPercent).toBe(40);
    expect(f).toHaveBeenCalled();
  });
  it('Perplexity maps recurring + bonus credits', async () => {
    const snap = await fetchTableRow(
      tableRow('perplexity'),
      { token: 'session=tok' },
      ctxWith(() => new Response(JSON.stringify({ recurringCredits: 100, bonusCredits: 20 }), { status: 200 })) as never,
    );
    expect(snap.balance).toBeDefined();
  });
});
