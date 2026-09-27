import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import type { WidgetFetchContext } from './registry';
import type { AiQuotaData } from '../../shared/widgets/payloads';
import { aiQuotaSchema } from '../../shared/widgets/ai-quota';
import '../widgets/ai-quota';
import { serverWidgets } from './registry';

function ctxWith(fetchMock: ReturnType<typeof vi.fn>, env: Record<string, string | undefined> = { CODEX_TOKEN: 'env-tok' }): WidgetFetchContext {
  return {
    fetch: fetchMock as unknown as typeof fetch,
    env,
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
    const res = await fn(ctxWith(f), { type: 'ai-quota', provider: 'codex' });
    const data = res as AiQuotaData;
    expect(data.provider).toBe('codex');
    expect(data.windows[0].usedPercent).toBe(10);
  });

  it('authenticates with the provider env var, not a config token', async () => {
    const payload = { plan_type: 'pro', rate_limit: { primary_window: { used_percent: 10, reset_at: 1735401600, limit_window_seconds: 18000 } } };
    const inits: RequestInit[] = [];
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      inits.push(init ?? {});
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const fn = serverWidgets.get('ai-quota' as never)!;
    await fn(ctxWith(f, { CODEX_TOKEN: 'env-tok' }), { type: 'ai-quota', provider: 'codex', token: 'leaked' });
    expect(JSON.stringify(inits[0].headers)).toContain('env-tok');
    expect(JSON.stringify(inits[0].headers)).not.toContain('leaked');
    expect('token' in aiQuotaSchema.parse({ type: 'ai-quota', provider: 'codex', token: 'leaked' })).toBe(false);
  });

  it('throws naming the env var when no token can be resolved', async () => {
    // HOME points nowhere so the provider's default credential file cannot
    // stand in for the env var this test is about.
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    const fn = serverWidgets.get('ai-quota' as never)!;
    await expect(
      fn(ctxWith(f, { HOME: '/nonexistent' }), { type: 'ai-quota', provider: 'codex' }),
    ).rejects.toThrow(/CODEX_API_KEY|no token/);
  });
});
