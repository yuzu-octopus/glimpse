import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';
// No credential field. The config is served to the browser verbatim, so a
// password in the YAML is a password in the page. The fetcher reads the
// environment instead: PIHOLE_PASSWORD / PIHOLE_TOKEN for pihole,
// ADGUARD_USERNAME / ADGUARD_PASSWORD for adguard, TECHNITIUM_TOKEN for
// technitium — one credential set per service, `url:` still per widget.

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const DNS_STATS_DEFAULTS = { service: 'pihole' } as const;
export const DNS_STATS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };
/** Three big value/label blocks over a bar graph. `rows` would promise a
 * paragraph where numbers land. */
export const DNS_STATS_SKELETON: SkeletonShape = 'chart';

export const dnsStatsSchema = z
  .object({
    type: z.literal('dns-stats'),
    ...sharedWidgetFields,
    service: z.enum(['pihole', 'adguard', 'technitium']).default(DNS_STATS_DEFAULTS.service),
    url: z.string(),
    // Glance's TLS-bypass switch. Declared only so the check below can see it:
    // zod strips unknown keys, so dropping the field outright would let
    // `allow-insecure: true` load clean and mean nothing — a promise the
    // fetcher cannot keep, since it has no way to skip certificate checks.
    'allow-insecure': z.boolean().optional(),
    'hide-graph': z.boolean().optional(),
    'hide-top-domains': z.boolean().optional(),
  })
  .superRefine((c, ctx) => {
    if (c['allow-insecure'] !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['allow-insecure'],
        message:
          'not supported — the dns-stats fetcher cannot skip TLS verification, so this key does nothing; delete it from the config',
      });
    }
  });

export type DnsStatsConfig = z.infer<typeof dnsStatsSchema>;
