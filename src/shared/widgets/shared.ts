import { z } from 'zod';

/** Props every widget accepts (glance "Shared Properties" table). Leaf module
 * so widget schemas and the registry can both import it without cycles. */
export const sharedWidgetFields = {
  title: z.string().optional(),
  'title-url': z.string().optional(),
  'hide-header': z.boolean().optional(),
  cache: z.string().optional(),
  'css-class': z.string().optional(),
};
