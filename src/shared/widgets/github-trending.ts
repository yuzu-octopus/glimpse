import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const TRENDING_DEFAULTS = { limit: 10, since: 'daily' as const };
export const TRENDING_PREF: Pref = { cols: 3, rows: 3, resizable: true, priority: 7, zone: 'main', preferredWidth: 340, preferredHeight: 360 };

export const githubTrendingSchema = z
  .object({
    type: z.literal('github-trending'),
    ...sharedWidgetFields,
    language: z.string().optional(),
    since: z.enum(['daily', 'weekly', 'monthly']).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  })
  .loose();
export type GithubTrendingConfig = z.infer<typeof githubTrendingSchema>;
