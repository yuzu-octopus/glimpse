import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const CALENDAR_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 8, zone: 'sidebar', preferredWidth: 340, preferredHeight: 320 };
/** A 7-column day grid. No shape in the four says "grid", and a solid block
 * is the only one that is not a stack of text lines. */
export const CALENDAR_SKELETON: SkeletonShape = 'chart';

/** The seven names the calendar widget's DAY_START map knows, in the kit's
 * sunday-first order. */
export const CALENDAR_FIRST_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const calendarSchema = z.object({
  type: z.literal('calendar'),
  ...sharedWidgetFields,
  // Case and padding are normalized so `Monday` and ` monday ` keep working,
  // but a name that is not a day used to render as a silent Monday; now it is
  // a config error at load instead of a week that starts on the wrong column.
  'first-day-of-week': z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(CALENDAR_FIRST_DAYS))
    .optional(),
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
