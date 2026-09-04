import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const CALENDAR_DEFAULTS = {} as const;
export const CALENDAR_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 8, zone: 'sidebar', preferredWidth: 340, preferredHeight: 320 };
export const CALENDAR_SKELETON: SkeletonShape = 'rows';

export const calendarSchema = z.object({
  type: z.literal('calendar'),
  ...sharedWidgetFields,
  'first-day-of-week': z.string().optional(),
});
export type CalendarConfig = z.infer<typeof calendarSchema>;

export const EVENTS_CALENDAR_DEFAULTS = { days: 14, limit: 20 } as const;
export const EVENTS_CALENDAR_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 7, zone: 'sidebar', preferredWidth: 340, preferredHeight: 360 };
export const EVENTS_CALENDAR_SKELETON: SkeletonShape = 'list';

export const eventsCalendarSchema = z.object({
  type: z.literal('events-calendar'),
  ...sharedWidgetFields,
  urls: z.array(z.string()).optional(),
  'ics-url': z.string().optional(),
  days: z.number().int().min(1).default(EVENTS_CALENDAR_DEFAULTS.days),
  limit: z.number().int().min(1).default(EVENTS_CALENDAR_DEFAULTS.limit),
}).refine((c) => (c.urls?.length ?? 0) + (c['ics-url'] ? 1 : 0) > 0, {
  message: 'events-calendar requires urls[] or ics-url',
});
export type EventsCalendarConfig = z.infer<typeof eventsCalendarSchema>;
