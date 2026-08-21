import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const dnsStatsSchema = z.object({
  type: z.literal('dns-stats'),
  ...sharedWidgetFields,
  service: z.enum(['pihole', 'adguard', 'technitium']).default('pihole'),
  url: z.string(),
  token: z.string().optional(),
  password: z.string().optional(),
  username: z.string().optional(),
  'allow-insecure': z.boolean().optional(),
  'hide-graph': z.boolean().optional(),
  'hide-top-domains': z.boolean().optional(),
});

export type DnsStatsConfig = z.infer<typeof dnsStatsSchema>;
