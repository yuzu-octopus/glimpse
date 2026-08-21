import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// Defaults — change here (cols/rows on 12-col, priority 0-10, zone main|sidebar, resizable)
export const TODO_PREF: Pref = { cols: 3, rows: 2, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 320, preferredHeight: 220 };

export const todoSchema = z.object({
  type: z.literal('todo'),
  ...sharedWidgetFields,
  id: z.string().optional(),
});
export type TodoConfig = z.infer<typeof todoSchema>;