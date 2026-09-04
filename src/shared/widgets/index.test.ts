import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { WidgetSchema, widgetMeta } from './index';
import { PREFERRED_SIZES, SKELETON_SHAPE } from './preferredSizes';
import type { Pref, SkeletonShape } from './shared';

const rows = Object.entries(widgetMeta) as [
  string,
  { schema: z.ZodType; pref: Pref; skeleton: SkeletonShape },
][];

describe('widget registry derivation', () => {
  it('covers all 32 widget types with pref + skeleton', () => {
    expect(rows).toHaveLength(32);
    // the union is built from exactly these schemas — reference check
    expect(WidgetSchema.options).toHaveLength(rows.length);
    for (const [, m] of rows) {
      expect(WidgetSchema.options).toContain(m.schema);
    }
    // derived maps cover exactly the registered types (no missing, no orphan)
    const types = rows.map(([t]) => t);
    expect(Object.keys(PREFERRED_SIZES).sort()).toEqual([...types].sort());
    expect(Object.keys(SKELETON_SHAPE).sort()).toEqual([...types].sort());
    for (const [t, m] of rows) {
      expect(m.pref.cols === null || Number.isInteger(m.pref.cols)).toBe(true);
      expect(m.pref.rows).toBeGreaterThan(0);
      expect(['list', 'stat', 'chart', 'rows']).toContain(m.skeleton);
      // registry key matches the schema's own type discriminator
      const probe = m.schema.safeParse({ type: t });
      if (!probe.success) {
        expect(probe.error.issues.some((i) => i.path[0] === 'type')).toBe(false);
      }
    }
  });

  it('preserves legacy pref values', () => {
    expect(PREFERRED_SIZES.clock).toEqual({
      cols: 3, rows: 2, resizable: false, priority: 9, zone: 'sidebar',
      preferredWidth: 300, preferredHeight: 200,
    });
    expect(PREFERRED_SIZES.rss).toEqual({
      cols: null, rows: 3, resizable: true, priority: 10, zone: 'main',
      preferredWidth: null, preferredHeight: null,
    });
    expect(SKELETON_SHAPE.rss).toBe('list');
    expect(SKELETON_SHAPE.clock).toBe('stat');
    expect(SKELETON_SHAPE.videos).toBe('chart');
    expect(SKELETON_SHAPE.timer).toBe('rows');
  });
});
