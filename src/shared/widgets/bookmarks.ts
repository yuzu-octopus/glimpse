import { z } from 'zod';
import { sharedWidgetFields } from './shared';

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
    .default([]),
  'same-tab': z.boolean().optional(),
  'hide-arrow': z.boolean().optional(),
  target: z.string().optional(),
});
export type BookmarksConfig = z.infer<typeof bookmarksSchema>;
