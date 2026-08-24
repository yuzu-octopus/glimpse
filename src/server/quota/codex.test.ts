import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { fetchCodexUsage } from './codex';

function makeCtx(route: Record<string, unknown>) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(route['https://chatgpt.com/backend-api/wham/usage']), { status: 200 }),
  );
  return {
    fetch: fetchMock as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
    fetchMock,
  };
}

describe('fetchCodexUsage', () => {
  it('parses primary + secondary windows and plan', async () => {
    const ctx = makeCtx({
      'https://chatgpt.com/backend-api/wham/usage': {
        plan_type: 'pro',
        rate_limit: {
          primary_window: { used_percent: 15, reset_at: 1735401600, limit_window_seconds: 18000 },
          secondary_window: { used_percent: 5, reset_at: 1735920000, limit_window_seconds: 604800 },
        },
      },
    });
    const snap = await fetchCodexUsage({ token: 'tok', accountId: 'acc' }, ctx as never);
    expect(snap.plan).toBe('pro');
    expect(snap.windows[0].usedPercent).toBe(15);
    expect(snap.windows[0].resetsAt).toBe(1735401600 * 1000);
  });

  it('throws sanitized on 401', async () => {
    const f = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    await expect(fetchCodexUsage({ token: 'bad' }, ctx as never)).rejects.toThrow(/401/);
  });
});
