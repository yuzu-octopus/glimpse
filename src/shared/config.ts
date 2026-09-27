import { z } from 'zod';
import { WidgetSchemaInput } from './widgets';

export type { WidgetConfig, WidgetType } from './widgets';

export const PAGE_WIDTHS = { default: 1600, slim: 1100, wide: 1920 } as const;

const ColumnSchema = z
  .object({
    size: z.enum(['small', 'full']).optional(),
    /** Names the column itself — the mobile section header. Without it the
     * header falls back to the first widget's title, then "Column N". */
    title: z.string().min(1).optional(),
    widgets: z.array(WidgetSchemaInput),
    span: z.number().int().min(1).max(12).optional(),
  })
  .refine((c) => c.size !== undefined || c.span !== undefined, {
    message: 'column requires `size` or `span`',
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

const PageSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().optional(),
    width: z.enum(['default', 'slim', 'wide']).optional(),
    'desktop-navigation-width': z.enum(['default', 'slim', 'wide']).optional(),
    'center-vertically': z.boolean().optional(),
    'hide-desktop-navigation': z.boolean().optional(),
    'show-mobile-header': z.boolean().optional(),
    'hide-headers': z.boolean().optional(),
    'head-widgets': z.array(WidgetSchemaInput).optional(),
    tiling: z.enum(['columns', 'auto', 'collage']).optional(),
    'min-column-width': z.number().int().min(1).optional(),
    // pure bento
    'grid-columns': z.number().int().min(2).max(12).optional(),
    'grid-row-height': z.number().int().min(32).max(200).optional(),
    columns: z.array(ColumnSchema).min(1).max(3).optional(),
    widgets: z.array(WidgetSchemaInput).optional(),
  })
  .superRefine((p, ctx) => {
    if (!p.columns && !p.widgets) {
      ctx.addIssue({ code: 'custom', message: 'Page needs `columns` or `widgets`', path: ['columns'] });
    }
  });
export type Page = z.infer<typeof PageSchema>;

/**
 * Custom CSS is the one theme-adjacent knob that survived the collapse to the
 * single astryx-dracula theme: a stylesheet appended after the theme so it
 * still wins. Top-level because the `theme:` block is gone.
 */
export const ConfigSchema = z
  .object({
    pages: z.array(PageSchema).min(1),
    'custom-css-file': z.string().optional(),
    // Declared only so the removal below can see it: zod strips unknown keys
    // before superRefine runs, so a `theme:` block must be a real field to be
    // detected at all. It never parses successfully.
    theme: z.unknown().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.theme !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['theme'],
        message:
          'block removed — Glimpse now uses the astryx-dracula theme; delete the theme block from your config (if you set a custom stylesheet, move it to a top-level `custom-css-file:` key)',
      });
    }
  });
export type Config = z.infer<typeof ConfigSchema>;

/** Config after slug derivation — every page has a unique slug. */
export type ResolvedConfig = Omit<Config, 'pages'> & {
  pages: (Page & { slug: string })[];
};
