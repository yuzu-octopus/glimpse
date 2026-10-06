import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const SYSTEM_STATS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };
/** One labelled row per reading, each with a severity bar — a row list, not
 * a single headline value. */
export const SYSTEM_STATS_SKELETON: SkeletonShape = 'rows';

export const systemStatsSchema = z
  .object({
    type: z.literal('system-stats'),
    /** Every real mount instead of just `/`. The kernel's pseudo-mounts
     *  (efivarfs, tmpfs, /sys, /proc, /dev, …) are filtered out of the
     *  payload either way; this only widens the result past root, for a box
     *  whose storage is not all under `/`. */
    'show-all-mounts': z.boolean().optional(),
    ...sharedWidgetFields,
  })
  .loose();

export type SystemStatsConfig = z.infer<typeof systemStatsSchema>;
