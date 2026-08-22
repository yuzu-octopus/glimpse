import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const CLOCK_DEFAULTS = { timezones: [] } as const;
export const CLOCK_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 9, zone: 'sidebar', preferredWidth: 300, preferredHeight: 200 };

export const clockSchema = z.object({
  type: z.literal('clock'),
  ...sharedWidgetFields,
  'hour-format': z.enum(['24h', '12h']).optional(),
  timezones: z
    .array(z.object({ timezone: z.string(), label: z.string().optional() }))
    .default([...CLOCK_DEFAULTS.timezones]),
});
export type ClockConfig = z.infer<typeof clockSchema>;
