import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const calendarSchema = z.object({
  type: z.literal('calendar'),
  ...sharedWidgetFields,
  'first-day-of-week': z.string().optional(),
});
export type CalendarConfig = z.infer<typeof calendarSchema>;

export const CALENDAR_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 8, zone: 'sidebar', preferredWidth: 340, preferredHeight: 320 };
