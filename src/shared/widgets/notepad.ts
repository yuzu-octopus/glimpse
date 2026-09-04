import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const NOTEPAD_DEFAULTS = {} as const;
export const NOTEPAD_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 320, preferredHeight: 240 };
export const NOTEPAD_SKELETON: SkeletonShape = 'rows';

export const notepadSchema = z.object({
  type: z.literal('notepad'),
  ...sharedWidgetFields,
  id: z.string().optional(),
  placeholder: z.string().optional(),
});

export type NotepadConfig = z.infer<typeof notepadSchema>;
