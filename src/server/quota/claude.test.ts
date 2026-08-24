import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import { fetchClaudeUsage } from './claude';

describe('fetchClaudeUsage', () => {
  it('maps five_hour + seven_day to windows', async () => {
    const payload = { five_hour: { utilization: 42, reset_at: '2026-01-01T00:00:00Z' }, seven_day: { utilization: 10 } };
    const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    const snap = await fetchClaudeUsage({ token: 'tok' }, ctx as never);
    expect(snap.windows.find((w) => w.label === 'five_hour')?.usedPercent).toBe(42);
  });
});
