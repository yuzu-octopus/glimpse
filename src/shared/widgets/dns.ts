import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const DNS_STATS_DEFAULTS = { service: 'pihole' } as const;
export const DNS_STATS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };

export const dnsStatsSchema = z.object({
  type: z.literal('dns-stats'),
  ...sharedWidgetFields,
  service: z.enum(['pihole', 'adguard', 'technitium']).default(DNS_STATS_DEFAULTS.service),
  url: z.string(),
  token: z.string().optional(),
  password: z.string().optional(),
  username: z.string().optional(),
  'allow-insecure': z.boolean().optional(),
  'hide-graph': z.boolean().optional(),
  'hide-top-domains': z.boolean().optional(),
});

export type DnsStatsConfig = z.infer<typeof dnsStatsSchema>;
