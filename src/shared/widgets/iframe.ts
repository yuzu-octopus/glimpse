import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const iframeSchema = z.object({
  type: z.literal('iframe'),
  ...sharedWidgetFields,
  source: z.string(),
  height: z.number().int().min(50).optional(),
});
export type IframeConfig = z.infer<typeof iframeSchema>;

export const htmlSchema = z.object({
  type: z.literal('html'),
  ...sharedWidgetFields,
  source: z.string(),
});
export type HtmlConfig = z.infer<typeof htmlSchema>;
