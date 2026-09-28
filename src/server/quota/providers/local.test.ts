import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TtlCache, Singleflight } from '../../cache';
import { fetchTableRow, tableRow } from './providerTable';

// Cleanup in afterEach, not at the end of the test body: a failed assertion
// would otherwise leave the fixture on disk for the rest of the run.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'glimpse-jetbrains-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const ctx = {
  fetch: async () => new Response('{}', { status: 200 }) as Response,
  env: {},
  cache: new TtlCache(),
  singleflight: new Singleflight(),
};

describe('local providers', () => {
  it('JetBrains reads XML quota file', async () => {
    const tmp = join(dir, 'quota.xml');
    writeFileSync(tmp, '<quota><credits used="30" total="100" /></quota>');
    const snap = await fetchTableRow(tableRow('jetbrains'), { token: '', tokenFile: tmp }, ctx as never);
    expect(snap.provider).toBe('jetbrains');
    expect(snap.windows[0].usedPercent).toBe(30);
  });

  it('throws sanitized when file missing', async () => {
    // The path is the user's own config value, so the message may name it —
    // but the token that sits beside it in the same config must not.
    await expect(
      fetchTableRow(tableRow('jetbrains'), { token: '', tokenFile: '/no/such.xml' }, ctx as never),
    ).rejects.toThrow(/not found/i);
  });
});
