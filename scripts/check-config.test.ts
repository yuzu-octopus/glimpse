import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function run(file: string): { code: number; out: string } {
  try {
    const out = execFileSync('bun', ['scripts/check-config.ts', file], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { code: err.status ?? 1, out: String(err.stdout ?? e) };
  }
}

function fixture(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-config-'));
  const file = join(dir, 'config.yml');
  writeFileSync(file, body);
  return file;
}

describe('check-config did-you-mean scope', () => {
  it('ignores non-widget `type:` keys (server-stats servers)', () => {
    const file = fixture(
      'pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: server-stats\n            servers:\n              - type: local\n                name: Glimpse\n',
    );
    const { code, out } = run(file);
    expect(code).toBe(0);
    expect(out).not.toContain('unknown widget type');
  });

  it('still suggests for a typo\'d widget type', () => {
    const file = fixture(
      'pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: rsss\n',
    );
    const { code, out } = run(file);
    expect(code).toBe(1);
    expect(out).toContain('unknown widget type "rsss" — did you mean "rss"?');
  });
});
