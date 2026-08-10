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
});
