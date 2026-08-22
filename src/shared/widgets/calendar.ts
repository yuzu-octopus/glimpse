import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const CALENDAR_DEFAULTS = {} as const;
export const CALENDAR_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 8, zone: 'sidebar', preferredWidth: 340, preferredHeight: 320 };

export const calendarSchema = z.object({
  type: z.literal('calendar'),
  ...sharedWidgetFields,
  'first-day-of-week': z.string().optional(),
});
export type CalendarConfig = z.infer<typeof calendarSchema>;
