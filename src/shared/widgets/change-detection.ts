import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const CHANGE_DETECTION_DEFAULTS = { limit: 10 } as const;
export const CHANGE_DETECTION_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: null,
  preferredHeight: null,
};
export const CHANGE_DETECTION_SKELETON: SkeletonShape = 'list';

export const changeDetectionSchema = z
  .object({
    type: z.literal('change-detection'),
    ...sharedWidgetFields,
    urls: z.array(z.url()).min(1).max(10),
    selector: z.string().min(1).max(200).optional(),
  })
  .loose();

export type ChangeDetectionConfig = z.infer<typeof changeDetectionSchema>;
