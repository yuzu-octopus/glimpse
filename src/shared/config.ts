import { z } from 'zod';
import { WidgetSchema } from './widgets';

export type { WidgetConfig, WidgetType } from './widgets';

export const ColumnSchema = z.object({
  size: z.enum(['small', 'full']),
  widgets: z.array(WidgetSchema),
  span: z.number().int().min(1).max(4).optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

export const PageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  width: z.enum(['default', 'slim', 'wide']).optional(),
  'desktop-navigation-width': z.enum(['default', 'slim', 'wide']).optional(),
  'center-vertically': z.boolean().optional(),
  'hide-desktop-navigation': z.boolean().optional(),
  'show-mobile-header': z.boolean().optional(),
  'hide-headers': z.boolean().optional(),
  'head-widgets': z.array(WidgetSchema).optional(),
  // 'columns' (default) = current glance flex behavior; 'auto' = balanced
  // grid tiles; 'collage' = dense bento grid + JS-measured row spans.
  tiling: z.enum(['columns', 'auto', 'collage']).optional(),
  'min-column-width': z.number().int().min(1).optional(),
  columns: z.array(ColumnSchema).min(1).max(3),
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
