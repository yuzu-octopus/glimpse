import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// Defaults — change here (cols/rows on 12-col, priority 0-10, zone main|sidebar, resizable)
export const SERVER_STATS_PREF: Pref = { cols: 6, rows: 2, resizable: false, priority: 7, zone: 'main', preferredWidth: 340, preferredHeight: 240 };

/** One monitored server: the local machine, or a remote Glimpse instance
 * exposing `/api/server-stats`. */
const serverEntrySchema = z.object({
  type: z.enum(['local', 'remote']).default('local'),
  /** Remote only: base URL of the other Glimpse instance. */
  url: z.string().optional(),
  /** Display name; falls back to the hostname (local) or URL (remote). */
  name: z.string().optional(),
});

export const serverStatsSchema = z
  .object({
    type: z.literal('server-stats'),
    ...sharedWidgetFields,
    /** Defaults to a single local server. */
    servers: z.array(serverEntrySchema).min(1).default([{ type: 'local' }]),
  })
  .loose();

export type ServerStatsConfig = z.infer<typeof serverStatsSchema>;