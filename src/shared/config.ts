import { z } from 'zod';
import { WidgetSchema } from './widgets';

export type { WidgetConfig, WidgetType } from './widgets';

export const ColumnSchema = z.object({
  size: z.enum(['small', 'full']),
  widgets: z.array(WidgetSchema),
  span: z.number().int().min(1).max(12).optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

export function resolveSpan(columns: Column[]): number[] {
  if (columns.every((c) => typeof c.span === 'number')) return columns.map((c) => c.span as number);
  if (columns.some((c) => typeof c.span === 'number')) throw new Error('mix of explicit span and size not allowed');
  const sizes = columns.map((c) => c.size);
  if (sizes.length === 1) return sizes[0] === 'small' ? [3] : [12];
  if (sizes.length === 2) {
    if (sizes[0] === 'full' && sizes[1] === 'full') return [6, 6];
    if (sizes[0] === 'full' && sizes[1] === 'small') return [9, 3];
    if (sizes[0] === 'small' && sizes[1] === 'full') return [3, 9];
  }
  if (sizes.length === 3) {
    if (sizes.every((s) => s === 'full')) return [4, 4, 4];
    if (sizes.filter((s) => s === 'full').length === 1) {
      const idx = sizes.indexOf('full');
      const out = [3, 3, 3];
      out[idx] = 6;
      return out;
    }
  }
  return columns.map(() => 4);
}

export const PageSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().optional(),
    width: z.enum(['default', 'slim', 'wide']).optional(),
    'desktop-navigation-width': z.enum(['default', 'slim', 'wide']).optional(),
    'center-vertically': z.boolean().optional(),
    'hide-desktop-navigation': z.boolean().optional(),
    'show-mobile-header': z.boolean().optional(),
    'hide-headers': z.boolean().optional(),
    'head-widgets': z.array(WidgetSchema).optional(),
    tiling: z.enum(['columns', 'auto', 'collage']).optional(),
    'min-column-width': z.number().int().min(1).optional(),
    // pure bento
    'grid-columns': z.number().int().min(2).max(12).optional(),
    'grid-row-height': z.number().int().min(32).max(200).optional(),
    columns: z.array(ColumnSchema).min(1).max(3).optional(),
    widgets: z.array(WidgetSchema).optional(),
  })
  .superRefine((p, ctx) => {
    if (!p.columns && !p.widgets) {
      ctx.addIssue({ code: 'custom', message: 'Page needs `columns` or `widgets`', path: ['columns'] });
    }
  });
export type Page = z.infer<typeof PageSchema>;

/** Glance HSL theme block (docs/configuration.md §Theme). */
export const ThemePresetSchema = z
  .object({
    light: z.boolean().optional(),
    'background-color': z.string().optional(),
    'primary-color': z.string().optional(),
    'positive-color': z.string().optional(),
    'negative-color': z.string().optional(),
    'contrast-multiplier': z.number().optional(),
    'text-saturation-multiplier': z.number().optional(),
  })
  .loose();
export type ThemePreset = z.infer<typeof ThemePresetSchema>;

export const ThemeConfigSchema = z
  .object({
    light: z.boolean().optional(),
    'background-color': z.string().optional(),
    'primary-color': z.string().optional(),
    'positive-color': z.string().optional(),
    'negative-color': z.string().optional(),
    'contrast-multiplier': z.number().optional(),
    'text-saturation-multiplier': z.number().optional(),
    'custom-css-file': z.string().optional(),
    'disable-picker': z.boolean().optional(),
    presets: z.record(z.string(), ThemePresetSchema).optional(),
  })
  .loose();
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const ConfigSchema = z.object({
  pages: z.array(PageSchema).min(1),
  theme: ThemeConfigSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Config after slug derivation — every page has a unique slug. */
export type ResolvedConfig = Omit<Config, 'pages'> & {
  pages: (Page & { slug: string })[];
};
