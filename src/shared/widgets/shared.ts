import { z } from 'zod';

/** Props every widget accepts (glance "Shared Properties" table). Leaf module
 * so widget schemas and the registry can both import it without cycles. */
export const sharedWidgetFields = {
  title: z.string().optional(),
  'title-url': z.string().optional(),
  'hide-header': z.boolean().optional(),
  cache: z.string().optional(),
  'css-class': z.string().optional(),
  // pure-compositor hints — ignored in columns mode, used when `widgets` is flat
  priority: z.number().int().min(0).max(10).optional(),
  span: z.number().int().min(1).max(12).optional(),
  zone: z.enum(['main', 'sidebar']).optional(),
};

/** Widget-local bento default, co-located with each widget's schema and
 * aggregated by preferredSizes.ts. Units are pure-bento grid units:
 * `cols` counts tracks of the underlying 12-col grid (null = fluid width),
 * `rows` counts `grid-row-height` units. `preferredWidth/Height` are the
 * legacy px hints still read by the collage chooser. */
export type Pref = {
  cols: number | null;
  rows: number;
  resizable: boolean;
  priority: number;
  zone: 'main' | 'sidebar';
  preferredWidth: number | null;
  preferredHeight: number | null;
};
