import { describe, expect, it } from 'vitest';
import { PREFERRED_SIZES, assertAllWidgetsCovered } from './preferredSizes';

const ALL_WIDGET_TYPES = [
  'clock',
  'weather',
  'calendar',
  'bookmarks',
  'search',
  'timer',
  'todo',
  'iframe',
  'html',
  'rss',
  'hacker-news',
  'reddit',
  'group',
  'split-column',
  'releases',
  'lobsters',
  'videos',
  'markets',
  'monitor',
  'custom-api',
  'repository',
  'system-stats',
  'server-stats',
  'docker-containers',
  'dns-stats',
] as const;

describe('PREFERRED_SIZES', () => {
  it('all widget types have preferred size', () => {
    expect(() => assertAllWidgetsCovered([...ALL_WIDGET_TYPES])).not.toThrow();
    // also ensure every key in PREFERRED_SIZES is accounted (no orphan)
    for (const t of ALL_WIDGET_TYPES) {
      expect(PREFERRED_SIZES[t as keyof typeof PREFERRED_SIZES]).toBeDefined();
    }
  });

  it('throws when a widget type is missing', () => {
    expect(() => assertAllWidgetsCovered(['__missing_widget__'])).toThrow(/missing entries/);
    expect(() => assertAllWidgetsCovered([...ALL_WIDGET_TYPES, '__extra__'])).toThrow(/__extra__/);
  });
});
