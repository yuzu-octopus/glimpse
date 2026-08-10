import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const clockSchema = z.object({
  type: z.literal('clock'),
  ...sharedWidgetFields,
  'hour-format': z.enum(['24h', '12h']).optional(),
  timezones: z
    .array(z.object({ timezone: z.string(), label: z.string().optional() }))
    .default([]),
});
export type ClockConfig = z.infer<typeof clockSchema>;
