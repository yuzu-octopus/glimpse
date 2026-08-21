import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const systemStatsSchema = z
  .object({
    type: z.literal('system-stats'),
    ...sharedWidgetFields,
  })
  .loose();

export type SystemStatsConfig = z.infer<typeof systemStatsSchema>;

export const SYSTEM_STATS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };
