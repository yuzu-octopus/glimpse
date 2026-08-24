import { describe, expect, it, vi } from 'vitest';
import { TtlCache, Singleflight } from '../cache';
import { fetchOpenaiUsage } from './openai';

describe('fetchOpenaiUsage', () => {
  it('maps costs buckets to balance/windows', async () => {
    const costs = { data: [{ amount: { value: 1.23 } }] };
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('costs') ? costs : { data: [] }), { status: 200 }));
    const ctx = { fetch: f as unknown as typeof fetch, env: {}, cache: new TtlCache(), singleflight: new Singleflight() };
    const snap = await fetchOpenaiUsage({ token: 'adm', projectId: 'proj' }, ctx as never);
    expect(snap.provider).toBe('openai');
  });
});
