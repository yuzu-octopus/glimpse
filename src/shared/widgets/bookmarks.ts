import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const bookmarksSchema = z.object({
  type: z.literal('bookmarks'),
  ...sharedWidgetFields,
  groups: z
    .array(
      z.object({
        title: z.string().optional(),
        color: z.string().optional(),
        links: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string().optional(),
              icon: z.string().optional(),
              'same-tab': z.boolean().optional(),
            }),
          )
          .default([]),
        'same-tab': z.boolean().optional(),
      }),
    )
    .default([]),
  'same-tab': z.boolean().optional(),
});
export type BookmarksConfig = z.infer<typeof bookmarksSchema>;

export const BOOKMARKS_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 300, preferredHeight: 240 };
