import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from './config';

const validYaml = {
  pages: [
    {
      name: 'Home',
      columns: [
        { size: 'small', widgets: [{ type: 'clock' }] },
        { size: 'full', widgets: [{ type: 'rss', feeds: [{ url: 'https://example.com/feed.xml' }] }] },
      ],
    },
  ],
};

describe('ConfigSchema', () => {
  it('accepts a valid pages/columns/widgets config', () => {
    const r = ConfigSchema.safeParse(validYaml);
    expect(r.success).toBe(true);
  });

  it('rejects an unknown widget type', () => {
    const r = ConfigSchema.safeParse({
      pages: [{ name: 'Home', columns: [{ size: 'full', widgets: [{ type: 'definitely-not-a-widget' }] }] }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a page with no columns', () => {
    const r = ConfigSchema.safeParse({ pages: [{ name: 'Home' }] });
    expect(r.success).toBe(false);
  });

  it('rejects more than three columns', () => {
    const col = { size: 'small' as const, widgets: [] };
    const r = ConfigSchema.safeParse({
      pages: [{ name: 'Home', columns: [col, col, col, col] }],
    });
    expect(r.success).toBe(false);
  });

  it('accepts flat widgets without columns', () => {
    const r = ConfigSchema.safeParse({ pages: [{ name: 'Home', widgets: [{ type: 'clock' }] }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pages[0].widgets![0].type).toBe('clock');
      expect(r.data.pages[0].columns).toBeUndefined();
    }
  });

  it('parses flat widget hints', () => {
    const r = ConfigSchema.safeParse({
      pages: [{ name: 'X', widgets: [{ type: 'clock', priority: 9, zone: 'sidebar', span: 2 }] }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const w = r.data.pages[0].widgets![0];
      expect(w.priority).toBe(9);
      expect(w.zone).toBe('sidebar');
      expect(w.span).toBe(2);
    }
  });

  it('parses grid-columns and grid-row-height', () => {
    const r = ConfigSchema.safeParse({
      pages: [{ name: 'Home', 'grid-columns': 12, 'grid-row-height': 96, widgets: [{ type: 'clock' }] }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pages[0]['grid-columns']).toBe(12);
      expect(r.data.pages[0]['grid-row-height']).toBe(96);
    }
  });

  it('rejects out-of-range grid-columns and grid-row-height', () => {
    const base = { name: 'Home', widgets: [{ type: 'clock' }] };
    expect(ConfigSchema.safeParse({ pages: [{ ...base, 'grid-columns': 1 }] }).success).toBe(false);
    expect(ConfigSchema.safeParse({ pages: [{ ...base, 'grid-columns': 13 }] }).success).toBe(false);
    expect(ConfigSchema.safeParse({ pages: [{ ...base, 'grid-row-height': 31 }] }).success).toBe(false);
    expect(ConfigSchema.safeParse({ pages: [{ ...base, 'grid-row-height': 201 }] }).success).toBe(false);
  });

  it('rejects a missing pages array', () => {
    expect(ConfigSchema.safeParse({}).success).toBe(false);
  });

  it('validates the theme block field types', () => {
    const r = ConfigSchema.safeParse({
      ...validYaml,
      theme: { 'background-color': '240 21 15', 'contrast-multiplier': 'nope' },
    });
    expect(r.success).toBe(false);
  });

  it('parses tiling, min-column-width, and column span', () => {
    const r = ConfigSchema.safeParse({
      pages: [
        {
          name: 'Home',
          tiling: 'auto',
          'min-column-width': 340,
          columns: [
            { size: 'small', span: 2, widgets: [{ type: 'clock' }] },
            { size: 'small', widgets: [{ type: 'clock' }] },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const page = r.data.pages[0];
      expect(page.tiling).toBe('auto');
      expect(page['min-column-width']).toBe(340);
      expect(page.columns![0].span).toBe(2);
      expect(page.columns![1].span).toBeUndefined();
    }
  });

  it('accepts tiling collage alongside auto', () => {
    const r = ConfigSchema.safeParse({
      pages: [
        {
          name: 'Home',
          tiling: 'collage',
          'min-column-width': 340,
          columns: [
            { size: 'small', span: 2, widgets: [{ type: 'clock' }] },
            { size: 'small', widgets: [{ type: 'rss', feeds: [{ url: 'https://example.com/feed.xml' }] }] },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pages[0].tiling).toBe('collage');
    }
  });

  it('defaults tiling and span to undefined (columns mode)', () => {
    const r = ConfigSchema.safeParse(validYaml);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pages[0].tiling).toBeUndefined();
      expect(r.data.pages[0]['min-column-width']).toBeUndefined();
      expect(r.data.pages[0].columns![0].span).toBeUndefined();
    }
  });

  it('rejects an unknown tiling value', () => {
    const r = ConfigSchema.safeParse({
      pages: [
        {
          name: 'Home',
          tiling: 'bogus',
          columns: [{ size: 'full', widgets: [{ type: 'clock' }] }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-number min-column-width', () => {
    const r = ConfigSchema.safeParse({
      pages: [
        {
          name: 'Home',
          'min-column-width': '340',
          columns: [{ size: 'full', widgets: [{ type: 'clock' }] }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a min-column-width below 1', () => {
    for (const value of [0, -50, 1.5]) {
      const r = ConfigSchema.safeParse({
        pages: [
          {
            name: 'Home',
            'min-column-width': value,
            columns: [{ size: 'full', widgets: [{ type: 'clock' }] }],
          },
        ],
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects out-of-range or non-number column spans', () => {
    for (const span of [0, 5, '2', 1.5, -1]) {
      const r = ConfigSchema.safeParse({
        pages: [
          {
            name: 'Home',
            tiling: 'auto',
            columns: [{ size: 'small', span, widgets: [{ type: 'clock' }] }],
          },
        ],
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects fractional or out-of-range integer-shaped widget fields', () => {
    const fixtures: { type: string; base: Record<string, unknown>; fields: string[] }[] = [
      {
        type: 'rss',
        base: { feeds: [{ url: 'https://example.com/feed.xml' }] },
        fields: ['limit', 'collapse-after', 'thumbnail-height', 'card-height'],
      },
      { type: 'hacker-news', base: {}, fields: ['limit', 'collapse-after'] },
      { type: 'videos', base: {}, fields: ['limit', 'collapse-after', 'collapse-after-rows'] },
      {
        type: 'repository',
        base: { repository: 'owner/repo' },
        fields: ['pull-requests-limit', 'issues-limit'],
      },
      { type: 'iframe', base: { source: 'https://example.com' }, fields: ['height'] },
    ];
    const parseWidget = (widget: Record<string, unknown>) =>
      ConfigSchema.safeParse({
        pages: [{ name: 'Home', columns: [{ size: 'full', widgets: [widget] }] }],
      });

    // glance parity: 'collapse-after*' accepts -1 (never collapse) and 0 (collapse all);
    // 'limit' accepts 0 (no additional per-feed limit); the rest must be positive ints.
    const invalidFor = (field: string): number[] =>
      field === 'collapse-after' || field === 'collapse-after-rows'
        ? [-2, 1.5]
        : field === 'limit'
          ? [-2, -1, 1.5]
          : [-1, 0, 1.5];

    for (const { type, base, fields } of fixtures) {
      for (const field of fields) {
        for (const value of invalidFor(field)) {
          const r = parseWidget({ type, ...base, [field]: value });
          expect(r.success, `${type}.${field} = ${value} should fail`).toBe(false);
        }
      }
    }
  });

  it('rejects fractional or non-positive monitor status codes', () => {
    for (const code of [200.5, -1, 0]) {
      const r = ConfigSchema.safeParse({
        pages: [
          {
            name: 'Home',
            columns: [
              {
                size: 'full',
                widgets: [
                  {
                    type: 'monitor',
                    sites: [
                      {
                        url: 'https://example.com',
                        'expected-status-code': code,
                        'alt-status-codes': [code],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(r.success, `status code ${code} should fail`).toBe(false);
    }
  });

  it('accepts integer boundary values for all swept fields', () => {
    const fixtures: { type: string; base: Record<string, unknown>; fields: string[] }[] = [
      {
        type: 'rss',
        base: { feeds: [{ url: 'https://example.com/feed.xml' }] },
        fields: ['limit', 'collapse-after', 'thumbnail-height', 'card-height'],
      },
      { type: 'hacker-news', base: {}, fields: ['limit', 'collapse-after'] },
      { type: 'videos', base: {}, fields: ['limit', 'collapse-after', 'collapse-after-rows'] },
      {
        type: 'repository',
        base: { repository: 'owner/repo' },
        fields: ['pull-requests-limit', 'issues-limit'],
      },
      { type: 'iframe', base: { source: 'https://example.com' }, fields: ['height'] },
    ];
    for (const { type, base, fields } of fixtures) {
      const widget: Record<string, unknown> = { type, ...base };
      for (const field of fields) widget[field] = field === 'height' ? 100 : 2;
      const r = ConfigSchema.safeParse({
        pages: [{ name: 'Home', columns: [{ size: 'full', widgets: [widget] }] }],
      });
      expect(r.success, `${type} with integer fields set should pass`).toBe(true);
    }

    // glance parity boundary values: collapse-after* -1 (never collapse), limit 0 (no per-feed limit)
    for (const { type, base, fields } of fixtures) {
      const widget: Record<string, unknown> = { type, ...base };
      for (const field of fields) {
        widget[field] =
          field === 'collapse-after' || field === 'collapse-after-rows'
            ? -1
            : field === 'limit'
              ? 0
              : field === 'height'
                ? 100
                : 2;
      }
      const r = ConfigSchema.safeParse({
        pages: [{ name: 'Home', columns: [{ size: 'full', widgets: [widget] }] }],
      });
      expect(r.success, `${type} with boundary values should pass`).toBe(true);
    }

    const monitor = ConfigSchema.safeParse({
      pages: [
        {
          name: 'Home',
          columns: [
            {
              size: 'full',
              widgets: [
                {
                  type: 'monitor',
                  sites: [
                    {
                      url: 'https://example.com',
                      'expected-status-code': 200,
                      'alt-status-codes': [204],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(monitor.success).toBe(true);
  });

  it('minecraft example limit is 3', () => {
    const raw = readFileSync('config.example.yml', 'utf8');
    expect(raw).toMatch(/Minecraft[\s\S]*?limit:\s*3/);
  });

  it('WidgetType has no twitch', () => {
    const src = readFileSync('src/shared/widgets/keyed.ts', 'utf8');
    expect(src).not.toMatch(/twitch-/);
    expect(src).not.toMatch(/twitch\.ts/);
  });
});
