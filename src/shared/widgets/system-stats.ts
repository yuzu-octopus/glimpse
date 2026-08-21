import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const systemStatsSchema = z
  .object({
    type: z.literal('system-stats'),
    ...sharedWidgetFields,
  })
  .loose();

export type SystemStatsConfig = z.infer<typeof systemStatsSchema>;
