import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const CONTRIBUTION_GRAPH_DEFAULTS = { limit: 52 } as const;
export const CONTRIBUTION_GRAPH_PREF: Pref = {
  cols: 6,
  rows: 2,
  resizable: false,
  priority: 5,
  zone: 'main',
  preferredWidth: 480,
  preferredHeight: 160,
};

export const CONTRIBUTION_GRAPH_SKELETON: SkeletonShape = 'rows';

export const contributionGraphSchema = z
  .object({
    type: z.literal('contribution-graph'),
    ...sharedWidgetFields,
    username: z.string().min(1),
    token: z.string().optional(),
    limit: z.number().int().min(1).max(104).default(CONTRIBUTION_GRAPH_DEFAULTS.limit),
  })
  .loose();

export type ContributionGraphConfig = z.infer<typeof contributionGraphSchema>;
