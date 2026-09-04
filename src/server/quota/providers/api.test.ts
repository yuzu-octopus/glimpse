import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../../cache';
import { fetchTableRow, tableRow } from './providerTable';

function ctx(payload: unknown) {
  const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  return { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() } as never;
}

describe('api providers', () => {
  it('OpenRouter maps credits + key limits', async () => {
    const snap = await fetchTableRow(
      tableRow('openrouter'),
      { token: 'sk-or-' },
      ctx({ data: { credits: { total_credits: 10, total_usage: 3 } } }),
    );
    expect(snap.provider).toBe('openrouter');
    expect(snap.windows[0].usedPercent).toBeCloseTo(30);
  });
  it('DeepSeek maps balance with paid vs granted', async () => {
    const snap = await fetchTableRow(
      tableRow('deepseek'),
      { token: 'sk-' },
      ctx({ balance_infos: [{ currency: 'USD', total_balance: 10, topped_up_balance: 6 }] }),
    );
    expect(snap.balance).toBe(10);
  });
  it('Moonshot maps available balance', async () => {
    const snap = await fetchTableRow(tableRow('moonshot'), { token: 'sk-' }, ctx({ data: { available_balance: 5.5 } }));
    expect(snap.balance).toBe(5.5);
  });
});
