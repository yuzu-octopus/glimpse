import { z } from 'zod';
import { sharedWidgetFields } from './shared';

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
  'new-tab': z.boolean().optional(),
  autofocus: z.boolean().optional(),
  placeholder: z.string().optional(),
  target: z.string().optional(),
  key: z.string().optional(),
});
export type SearchConfig = z.infer<typeof searchSchema>;
