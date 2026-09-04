import { describe, expect, it } from 'vitest';
import { widgetMeta, type WidgetType } from '../../shared/widgets';
import { widgetLoaders } from '../../client/widgets';
import { serverWidgets } from './registry';
import './index';

/**
 * Widgets with no server fetcher on purpose: pure config-driven renderers
 * plus the container types, which never fetch. Everything else must register
 * a fetcher — a missing import in index.ts used to mean silent null data.
 */
const CONFIG_ONLY: Record<string, true> = {
  bookmarks: true,
  calendar: true,
  clock: true,
  group: true,
  html: true,
  iframe: true,
  notepad: true,
  search: true,
  'split-column': true,
  timer: true,
  todo: true,
};

/** Containers never lazy-load a chunk (ensureWidgetLoaded returns null). */
const CONTAINERS: Record<string, true> = {
  group: true,
  'split-column': true,
};

const types = Object.keys(widgetMeta) as WidgetType[];

describe('widget registry coverage', () => {
  it('registers a server fetcher for every data widget', () => {
    for (const t of types) {
      if (CONFIG_ONLY[t]) continue;
      expect(serverWidgets.has(t), `server fetcher missing for "${t}"`).toBe(true);
    }
  });

  it('registers a client loader for every widget except containers', () => {
    for (const t of types) {
      if (CONTAINERS[t]) continue;
      expect(widgetLoaders[t], `client loader missing for "${t}"`).toBeDefined();
    }
  });

  it('has no orphan server fetchers or client loaders', () => {
    for (const t of serverWidgets.keys()) {
      expect(types, `orphan server fetcher "${t}"`).toContain(t);
    }
    for (const t of Object.keys(widgetLoaders)) {
      expect(types, `orphan client loader "${t}"`).toContain(t);
    }
  });
});
