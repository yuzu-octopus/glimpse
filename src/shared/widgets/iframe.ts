import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const IFRAME_DEFAULTS = {} as const;
export const IFRAME_PREF: Pref = { cols: 6, rows: 3, resizable: false, priority: 4, zone: 'main', preferredWidth: 500, preferredHeight: 400 };
export const IFRAME_SKELETON: SkeletonShape = 'rows';

export const iframeSchema = z.object({
  type: z.literal('iframe'),
  ...sharedWidgetFields,
  source: z.string(),
  height: z.number().int().min(50).optional(),
});
export type IframeConfig = z.infer<typeof iframeSchema>;

export const HTML_DEFAULTS = {} as const;
export const htmlSchema = z.object({
  type: z.literal('html'),
  ...sharedWidgetFields,
  source: z.string(),
});
export type HtmlConfig = z.infer<typeof htmlSchema>;

export const HTML_PREF: Pref = { cols: null, rows: 2, resizable: true, priority: 4, zone: 'main', preferredWidth: null, preferredHeight: 200 };
export const HTML_SKELETON: SkeletonShape = 'rows';
