import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const BOOKMARKS_DEFAULTS = { groups: [] } as const;
export const BOOKMARKS_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 300, preferredHeight: 240 };
export const BOOKMARKS_SKELETON: SkeletonShape = 'rows';

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
    .default([...BOOKMARKS_DEFAULTS.groups]),
  'same-tab': z.boolean().optional(),
});
export type BookmarksConfig = z.infer<typeof bookmarksSchema>;
