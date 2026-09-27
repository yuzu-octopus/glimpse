import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const BOOKMARKS_DEFAULTS = { groups: [] } as const;
export const BOOKMARKS_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 300, preferredHeight: 240 };
/** An icon tile beside a title and an optional description. */
export const BOOKMARKS_SKELETON: SkeletonShape = 'list';

export const bookmarksSchema = z.object({
  type: z.literal('bookmarks'),
  ...sharedWidgetFields,
  groups: z
    .array(
      z.object({
        title: z.string().optional(),
        /**
         * Named tag accents only. This was a free-form string painted straight
         * onto the title, so `color: purple` made purple decoration — and
         * purple is the tappable hue. The kit's sixth tag accent, blue, is
         * #BD93F9 in this theme, i.e. that same purple, so it is excluded too.
         */
        color: z.enum(['green', 'cyan', 'yellow', 'orange', 'pink']).optional(),
        links: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string().optional(),
              icon: z.string().optional(),
              'same-tab': z.boolean().optional(),
              'hide-arrow': z.boolean().optional(),
              target: z.string().optional(),
            }),
          )
          .default([]),
        'same-tab': z.boolean().optional(),
        'hide-arrow': z.boolean().optional(),
        target: z.string().optional(),
      }),
    )
    .default([...BOOKMARKS_DEFAULTS.groups]),
  'same-tab': z.boolean().optional(),
});
export type BookmarksConfig = z.infer<typeof bookmarksSchema>;
