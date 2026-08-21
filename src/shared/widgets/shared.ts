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
  span: z.number().int().min(1).max(4).optional(),
  zone: z.enum(['main', 'sidebar']).optional(),
};
