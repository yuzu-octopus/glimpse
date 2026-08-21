import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const todoSchema = z.object({
  type: z.literal('todo'),
  ...sharedWidgetFields,
  id: z.string().optional(),
});
export type TodoConfig = z.infer<typeof todoSchema>;

export const TODO_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 320, preferredHeight: 220 };
