import { z } from 'zod';
import { sharedWidgetFields } from './shared';

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
