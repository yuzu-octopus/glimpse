import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import { fetchCopilotUsage } from './copilot';

describe('fetchCopilotUsage', () => {
  it('maps premium + chat to two windows', async () => {
    const payload = { premium_interactions: { used: 30, total: 100 }, chat: { used: 10, total: 100 } };
    const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    const snap = await fetchCopilotUsage({ token: 'ghp_' }, ctx as never);
    expect(snap.windows.length).toBe(2);
    expect(snap.windows[0].usedPercent).toBe(30);
  });
});
