import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// Defaults — change here (cols/rows on 12-col, priority 0-10, zone main|sidebar, resizable)
export const SYSTEM_STATS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };

export const systemStatsSchema = z
  .object({
    type: z.literal('system-stats'),
    ...sharedWidgetFields,
  })
  .loose();

export type SystemStatsConfig = z.infer<typeof systemStatsSchema>;