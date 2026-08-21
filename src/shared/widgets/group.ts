import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

/**
 * Container widgets. The child union (WidgetSchema in index.ts) is wired in
 * after that module finishes building, avoiding a module-init import cycle
 * (index -> group -> index) that trips TS circular-inference detection.
 * The lazy callback only runs at parse time, so the ref is always set.
 */
let widgetSchemaRef: z.ZodType | null = null;

function recursiveWidgets(): z.ZodType {
  if (!widgetSchemaRef) throw new Error('widget schemas not initialized');
  return widgetSchemaRef;
}

export function setWidgetSchemaRef(schema: z.ZodType): void {
  widgetSchemaRef = schema;
}

export const groupSchema = z.object({
  type: z.literal('group'),
  ...sharedWidgetFields,
  widgets: z.array(z.lazy(recursiveWidgets)).min(1),
});
export type GroupConfig = z.infer<typeof groupSchema>;

export const splitColumnSchema = z.object({
  type: z.literal('split-column'),
  ...sharedWidgetFields,
  widgets: z.array(z.lazy(recursiveWidgets)).min(2).max(2),
});
export type SplitColumnConfig = z.infer<typeof splitColumnSchema>;

export const GROUP_PREF: Pref = { cols: 4, rows: 3, resizable: false, priority: 5, zone: 'main', preferredWidth: 340, preferredHeight: 320 };
export const SPLIT_COLUMN_PREF: Pref = { cols: null, rows: 3, resizable: true, priority: 5, zone: 'main', preferredWidth: null, preferredHeight: 320 };
