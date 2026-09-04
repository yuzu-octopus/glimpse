import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const TODO_DEFAULTS = {} as const;
export const TODO_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 320, preferredHeight: 220 };
export const TODO_SKELETON: SkeletonShape = 'rows';

export const todoSchema = z.object({
  type: z.literal('todo'),
  ...sharedWidgetFields,
  id: z.string().optional(),
});
export type TodoConfig = z.infer<typeof todoSchema>;