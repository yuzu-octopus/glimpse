import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import type { WidgetFetchContext } from './registry';
import type { AiQuotaData } from '../../shared/widgets/payloads';
import '../widgets/ai-quota';
import { serverWidgets } from './registry';

function ctxWith(fetchMock: ReturnType<typeof vi.fn>): WidgetFetchContext {
  return {
    fetch: fetchMock as unknown as typeof fetch,
    env: { CODEX_TOKEN: 'tok' },
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

describe('ai-quota widget', () => {
  it('returns snapshot via fetchUsage', async () => {
    const payload = {
      plan_type: 'pro',
      rate_limit: { primary_window: { used_percent: 10, reset_at: 1735401600, limit_window_seconds: 18000 } },
    };
    const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const fn = serverWidgets.get('ai-quota' as never)!;
    const res = await fn(ctxWith(f), { type: 'ai-quota', provider: 'codex', token: 'tok' });
    const data = res as AiQuotaData;
    expect(data.provider).toBe('codex');
    expect(data.windows[0].usedPercent).toBe(10);
  });
});
