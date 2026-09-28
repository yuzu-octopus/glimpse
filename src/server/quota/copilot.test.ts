import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import { fetchCopilotUsage } from './copilot';

describe('fetchCopilotUsage', () => {
  it('maps premium + chat to two ordered, labelled windows', async () => {
    const payload = { premium_interactions: { used: 30, total: 100 }, chat: { used: 10, total: 100 } };
    const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    const snap = await fetchCopilotUsage({ token: 'ghp_' }, ctx as never);
    // Premium first — the two bars are not interchangeable, and `windowMinutes:
    // 0` / `resetsAt: 0` is the encoding that means "no reset info", not NaN.
    expect(snap.windows).toEqual([
      { usedPercent: 30, windowMinutes: 0, resetsAt: 0, label: 'premium' },
      { usedPercent: 10, windowMinutes: 0, resetsAt: 0, label: 'chat' },
    ]);
  });

  it('reports 0% rather than NaN when nothing has been used', async () => {
    // The percentage is a bare division; an empty plan would otherwise render
    // a bar labelled "NaN%".
    const payload = { premium_interactions: { used: 0, total: 0 }, chat: { used: 0, total: 0 } };
    const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    const snap = await fetchCopilotUsage({ token: 'ghp_' }, ctx as never);
    expect(snap.windows.map((w) => w.usedPercent)).toEqual([0, 0]);
  });
});
