import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const calendarSchema = z.object({
  type: z.literal('calendar'),
  ...sharedWidgetFields,
  'first-day-of-week': z.string().optional(),
});
export type CalendarConfig = z.infer<typeof calendarSchema>;
