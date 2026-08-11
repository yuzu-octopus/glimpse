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
      expect(page.columns[0].span).toBe(2);
      expect(page.columns[1].span).toBeUndefined();
    }
  });

  it('defaults tiling and span to undefined (columns mode)', () => {
    const r = ConfigSchema.safeParse(validYaml);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pages[0].tiling).toBeUndefined();
      expect(r.data.pages[0]['min-column-width']).toBeUndefined();
      expect(r.data.pages[0].columns[0].span).toBeUndefined();
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
    for (const value of [0, -50]) {
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
    for (const span of [0, 5, '2']) {
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
});
