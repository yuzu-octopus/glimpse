import { describe, expect, it } from 'vitest';
import { CONFIG_ONLY, widgetMeta, type WidgetType } from '../../shared/widgets';
import { widgetLoaders } from '../../client/widgets';
import { serverWidgets } from './registry';
import './index';

/**
 * Widgets with no server fetcher on purpose: pure config-driven renderers
 * plus the container types, which never fetch. Everything else must register
 * a fetcher — a missing import in index.ts used to mean silent null data.
 *
 * The set itself lives in `shared/widgets` (derived from the same registry
 * row as the schema), because the render layer needs it too: a config-only
 * widget's payload is `data: null` forever, and treating that as "still
 * loading" strands a skeleton that can never resolve. The first test below
 * is what keeps the two in step — a type flagged config-only that has a
 * fetcher, or a type with no fetcher that is not flagged, both fail here.
 */

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

  it('agrees with the server about which types are config-only', () => {
    // Both directions, so the flag cannot rot: a type the server fetches
    // cannot be flagged config-only (its data would never render), and a
    // type the server does not fetch must be (or its skeleton is stranded).
    for (const t of types) {
      expect(CONFIG_ONLY[t] === true, `"${t}" config-only flag must match the server`).toBe(
        !serverWidgets.has(t),
      );
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
