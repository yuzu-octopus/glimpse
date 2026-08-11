import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const todoSchema = z.object({
  type: z.literal('todo'),
  ...sharedWidgetFields,
  id: z.string().optional(),
});
export type TodoConfig = z.infer<typeof todoSchema>;
