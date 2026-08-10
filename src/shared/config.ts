import { z } from 'zod';
import { WidgetSchema } from './widgets';

export type { WidgetConfig, WidgetType } from './widgets';

export const ColumnSchema = z.object({
  size: z.enum(['small', 'full']),
  widgets: z.array(WidgetSchema),
});
export type Column = z.infer<typeof ColumnSchema>;

export const PageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  width: z.enum(['default', 'slim', 'wide']).optional(),
  'center-vertically': z.boolean().optional(),
  'head-widgets': z.array(WidgetSchema).optional(),
  columns: z.array(ColumnSchema).min(1).max(3),
});
export type Page = z.infer<typeof PageSchema>;

/** Glance HSL theme block (docs/configuration.md §Theme). */
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
