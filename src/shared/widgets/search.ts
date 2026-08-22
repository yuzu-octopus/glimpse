import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const SEARCH_DEFAULTS = { bangs: [], 'new-tab': true } as const;
export const SEARCH_PREF: Pref = { cols: 4, rows: 1, resizable: false, priority: 9, zone: 'main', preferredWidth: 300, preferredHeight: 90 };

export const searchSchema = z.object({
  type: z.literal('search'),
  ...sharedWidgetFields,
  'search-engine': z
    .union([
      z.string(), // preset name (duckduckgo/google/bing/...) or custom URL with {QUERY}
      z.object({ name: z.string(), url: z.string() }),
    ])
    .optional(),
  bangs: z
    .array(
      z.object({
        title: z.string(),
        shortcut: z.string(),
        url: z.string(),
      }),
    )
    .default([...SEARCH_DEFAULTS.bangs]),
  'new-tab': z.boolean().default(SEARCH_DEFAULTS['new-tab']),
  autofocus: z.boolean().optional(),
  placeholder: z.string().optional(),
  target: z.string().optional(),
  key: z.string().optional(),
});
export type SearchConfig = z.infer<typeof searchSchema>;
