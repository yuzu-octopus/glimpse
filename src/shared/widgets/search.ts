import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// Defaults — change here (cols/rows on 12-col, priority 0-10, zone main|sidebar, resizable)
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
    .default([]),
  'new-tab': z.boolean().default(true),
  autofocus: z.boolean().optional(),
  placeholder: z.string().optional(),
  target: z.string().optional(),
  key: z.string().optional(),
});
export type SearchConfig = z.infer<typeof searchSchema>;