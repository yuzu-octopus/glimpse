import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TtlCache, Singleflight } from '../../cache';
import { fetchJetbrainsUsage } from './jetbrains';

describe('local providers', () => {
  it('JetBrains reads XML quota file', async () => {
    const tmp = `/tmp/glimpse-jetbrains-test-${Date.now()}.xml`;
    writeFileSync(tmp, '<quota><credits used="30" total="100" /></quota>');
    const ctx = {
      fetch: async () => new Response('{}', { status: 200 }) as Response,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    const snap = await fetchJetbrainsUsage({ token: '', tokenFile: tmp }, ctx as never);
    expect(snap.windows[0].usedPercent).toBe(30);
    try { unlinkSync(tmp); } catch {}
  });
  it('throws sanitized when file missing', async () => {
    const ctx = {
      fetch: async () => new Response('{}', { status: 200 }) as Response,
      env: {},
      cache: new TtlCache(),
      singleflight: new Singleflight(),
    };
    await expect(fetchJetbrainsUsage({ token: '', tokenFile: '/no/such.xml' }, ctx as never)).rejects.toThrow(/not found/i);
  });
});
