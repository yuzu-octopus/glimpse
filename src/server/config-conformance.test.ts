import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __yamlParsersForTests, loadConfig } from './config';

const { fallback } = __yamlParsersForTests;
const BunYAML = (
  globalThis as unknown as { Bun?: { YAML?: { parse(s: string): unknown } } }
).Bun?.YAML;
const agree = BunYAML ? it : it.skip;

describe('YAML parser conformance (Bun.YAML vs fallback)', () => {
  const docs = [
    'pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: clock\n',
    'theme:\n  light: true\n  contrast-multiplier: 1.2\n  background-color: "10 20 30"\n',
    'pages:\n  - name: X\n    columns:\n      - size: small\n        widgets:\n          - type: rss\n            limit: 5\n            hide-header: false\n',
    '# comment\npages: [{ type: clock }]\n',
    "pages:\n  - name: 'My Home!'\n    slug: home\n",
  ];
  for (const [i, doc] of docs.entries()) {
    agree(`doc ${i} parses identically`, () => {
      expect(fallback(doc)).toEqual(BunYAML!.parse(doc));
    });
  }

  it('fallback rejects unclosed flow collections like Bun.YAML', () => {
    expect(() => fallback('pages: [unclosed')).toThrow();
    if (BunYAML) expect(() => BunYAML.parse('pages: [unclosed')).toThrow();
  });

  it('fallback handles scalars, nesting and sequences', () => {
    expect(fallback('a: 1\nb: true\nc: null\nd: hello\n')).toEqual({
      a: 1,
      b: true,
      c: null,
      d: 'hello',
    });
  });
});

describe('config dx', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'glimpse-dx-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.GLIMPSE_DX_UNSET;
    delete process.env.GLIMPSE_DX_SET;
    delete process.env.GLIMPSE_DX_EMPTY;
  });

  function write(name: string, content: string): string {
    const p = join(dir, name);
    writeFileSync(p, content);
    return p;
  }

  const page = (url: string): string => `pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: rss
            feeds:
              - url: ${url}
`;

  it('uses the ${VAR:-fallback} default when the var is missing', () => {
    const r = loadConfig(write('c.yml', page('https://example.com/${GLIMPSE_DX_UNSET:-fb}/x.xml')));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.config)).toContain('https://example.com/fb/x.xml');
  });

  it('prefers a set var over the fallback', () => {
    process.env.GLIMPSE_DX_SET = 'real';
    const r = loadConfig(write('c.yml', page('https://example.com/${GLIMPSE_DX_SET:-fb}/x.xml')));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.config)).toContain('https://example.com/real/x.xml');
  });

  it('supports the ${VAR-fallback} form and empty fallbacks', () => {
    const r = loadConfig(write('c.yml', page('https://example.com/${GLIMPSE_DX_UNSET-fb}/x.xml')));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.config)).toContain('https://example.com/fb/x.xml');
    process.env.GLIMPSE_DX_EMPTY = '';
    const r2 = loadConfig(write('c2.yml', page('https://example.com/${GLIMPSE_DX_EMPTY:-fb}/x.xml')));
    expect(r2.ok).toBe(true);
    expect(JSON.stringify(r2.config)).toContain('https://example.com/fb/x.xml');
  });

  it('leaves ${secret:...} untouched', () => {
    const r = loadConfig(write('c.yml', page('https://example.com/${secret:tok}/x.xml')));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.config)).toContain('${secret:tok}');
  });

  it('warns instead of dropping non-pages/theme $include keys', () => {
    write(
      'extra.yml',
      'server: { port: 1234 }\npages:\n  - name: Extra\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n',
    );
    const main = write('main.yml', '$include: extra.yml\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n');
    const r = loadConfig(main);
    expect(r.ok).toBe(true);
    expect(r.config?.pages.map((p) => p.name)).toEqual(['Home', 'Extra']);
    expect(r.warnings?.some((w) => w.includes('"server"'))).toBe(true);
  });
});
