import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const feedUrlSchema = z.object({ feeds: z.array(z.object({ url: z.string() })) });
function firstFeedUrl(widget: unknown): string {
  return feedUrlSchema.parse(widget).feeds[0].url;
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'glimpse-config-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

const VALID = `
pages:
  - name: Home
    columns:
      - size: small
        widgets:
          - type: clock
      - size: full
        widgets:
          - type: rss
            feeds:
              - url: https://example.com/feed.xml
`;

describe('loadConfig', () => {
  it('loads a valid config and derives slugs', () => {
    const r = loadConfig(write('glance.yml', VALID));
    expect(r.ok).toBe(true);
    expect(r.config?.pages[0].slug).toBe('home');
  });

  it('loads a flat bento page without columns', () => {
    const r = loadConfig(
      write(
        'glance.yml',
        `
pages:
  - name: Home
    grid-columns: 12
    grid-row-height: 96
    widgets:
      - type: clock
      - type: rss
        feeds:
          - url: https://example.com/feed.xml
`,
      ),
    );
    expect(r.ok).toBe(true);
    expect(r.config?.pages[0].widgets).toHaveLength(2);
    expect(r.config?.pages[0]['grid-columns']).toBe(12);
    expect(r.config?.pages[0]['grid-row-height']).toBe(96);
  });

  it('uses an explicit slug verbatim', () => {
    const r = loadConfig(write('glance.yml', VALID.replace('- name: Home', '- name: Home\n    slug: start')));
    expect(r.ok).toBe(true);
    expect(r.config?.pages[0].slug).toBe('start');
  });

  it('slugifies names with spaces and punctuation', () => {
    const r = loadConfig(write('glance.yml', VALID.replace('- name: Home', '- name: "My Home Page!"')));
    expect(r.config?.pages[0].slug).toBe('my-home-page');
  });

  it('reports duplicate slugs', () => {
    const twoPages = `
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
  - name: "home"
    columns:
      - size: full
        widgets: [{ type: clock }]
`;
    const r = loadConfig(write('glance.yml', twoPages));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('duplicate page slug'))).toBe(true);
  });

  it('rejects invalid YAML', () => {
    const r = loadConfig(write('glance.yml', 'pages: [unclosed'));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('invalid YAML'))).toBe(true);
  });

  it('reports a missing config file', () => {
    const r = loadConfig(join(dir, 'nope.yml'));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('cannot read'))).toBe(true);
  });

  it('requires at least one full column', () => {
    const bad = `
pages:
  - name: Home
    columns:
      - size: small
        widgets: [{ type: clock }]
`;
    const r = loadConfig(write('glance.yml', bad));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('at least one full column'))).toBe(true);
  });

  it('rejects more than two full columns', () => {
    const bad = `
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
      - size: full
        widgets: [{ type: clock }]
      - size: full
        widgets: [{ type: clock }]
`;
    const r = loadConfig(write('glance.yml', bad));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('more than two full columns'))).toBe(true);
  });

  it('rejects a group widget nested inside a group', () => {
    const bad = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: group
            widgets:
              - type: group
                widgets: [{ type: clock }]
`;
    const r = loadConfig(write('glance.yml', bad));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('cannot contain'))).toBe(true);
  });

  it('interpolates env vars from the environment', () => {
    process.env.GLIMPSE_TEST_TOKEN = 'sekrit';
    const r = loadConfig(write('glance.yml', VALID.replace('https://example.com/feed.xml', 'https://example.com/${GLIMPSE_TEST_TOKEN}/feed.xml')));
    expect(r.ok).toBe(true);
    expect(firstFeedUrl(r.config!.pages[0].columns![1].widgets[0])).toBe('https://example.com/sekrit/feed.xml');
  });

  it('errors when an env var is missing', () => {
    const r = loadConfig(write('glance.yml', VALID.replace('https://example.com/feed.xml', 'https://example.com/${GLIMPSE_MISSING_VAR}/feed.xml')));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('GLIMPSE_MISSING_VAR'))).toBe(true);
  });

  it('does not touch ${secret:...} Docker syntax', () => {
    const r = loadConfig(write('glance.yml', VALID.replace('https://example.com/feed.xml', 'https://example.com/${secret:github_token}/feed.xml')));
    expect(r.ok).toBe(true);
    expect(firstFeedUrl(r.config!.pages[0].columns![1].widgets[0])).toBe('https://example.com/${secret:github_token}/feed.xml');
  });

  it('merges included files (pages appended, theme overridden)', () => {
    write('extra.yml', `
pages:
  - name: Extra
    columns:
      - size: full
        widgets: [{ type: clock }]
theme:
  'primary-color': 10 50 50
`);
    const main = write('glance.yml', `
$include: extra.yml
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
theme:
  'primary-color': 200 50 50
  'background-color': 0 0 10
`);
    const r = loadConfig(main);
    expect(r.ok).toBe(true);
    expect(r.config?.pages.map((p) => p.name)).toEqual(['Home', 'Extra']);
    expect(r.config?.theme?.['primary-color']).toBe('10 50 50');
    expect(r.config?.theme?.['background-color']).toBe('0 0 10');
  });

  it('detects circular includes', () => {
    write('a.yml', '$include: b.yml\npages:\n  - name: A\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n');
    write('b.yml', '$include: a.yml\npages:\n  - name: B\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n');
    const r = loadConfig(join(dir, 'a.yml'));
    expect(r.ok).toBe(false);
    expect(r.errors?.some((e) => e.includes('circular'))).toBe(true);
  });
});
