import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const RADAR_DEFAULTS = { zoom: 7 } as const;
export const RADAR_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: false,
  priority: 8,
  zone: 'main',
  preferredWidth: 320,
  preferredHeight: 320,
};

export const RADAR_SKELETON: SkeletonShape = 'rows';

export const radarSchema = z.object({
  type: z.literal('weather-radar'),
  ...sharedWidgetFields,
  location: z.string(),
  zoom: z.number().int().min(3).max(10).optional(),
});
export type RadarConfig = z.infer<typeof radarSchema>;
