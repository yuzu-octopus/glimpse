import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const clockSchema = z.object({
  type: z.literal('clock'),
  ...sharedWidgetFields,
  'hour-format': z.enum(['24h', '12h']).optional(),
  timezones: z
    .array(z.object({ timezone: z.string(), label: z.string().optional() }))
    .default([]),
});
export type ClockConfig = z.infer<typeof clockSchema>;

export const CLOCK_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 9, zone: 'sidebar', preferredWidth: 300, preferredHeight: 200 };
