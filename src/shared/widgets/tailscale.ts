import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const TAILSCALE_DEFAULTS = {
  /** `-` is Tailscale's own shorthand for "whichever tailnet owns this key"
   *  (tailscale.com/kb/1215/oauth-clients#shorthand-notation-for-tailnet-id). */
  tailnet: '-',
  limit: 20,
} as const;
export const TAILSCALE_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: 340,
  preferredHeight: 220,
};
export const TAILSCALE_SKELETON: SkeletonShape = 'rows';

export const tailscaleSchema = z
  .object({
    type: z.literal('tailscale'),
    ...sharedWidgetFields,
    /** Tailscale API access key (`tskey-…`). Interpolation happens server-side
     *  at config load, so the usual `api-key: ${TS_API_KEY}` keeps the secret
     *  out of the file. Left unset, the fetcher falls back to the TS_API_KEY
     *  environment variable. Needs the `devices:core:read` scope. */
    'api-key': z.string().optional(),
    /** Tailnet id or `-` for the tailnet owning the key. */
    tailnet: z.string().default(TAILSCALE_DEFAULTS.tailnet),
    /** Online devices are listed first, so this is the visible head count. */
    limit: z.number().int().min(1).max(200).default(TAILSCALE_DEFAULTS.limit),
  })
  .loose();

export type TailscaleConfig = z.infer<typeof tailscaleSchema>;
