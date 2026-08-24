import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

export const NETWORK_DEFAULTS = { pingTarget: '1.1.1.1', publicIp: true } as const;
export const NETWORK_PREF: Pref = { cols: 2, rows: 1, resizable: false, priority: 6, zone: 'main', preferredWidth: 300, preferredHeight: 140 };

export const networkSchema = z
  .object({
    type: z.literal('network'),
    ...sharedWidgetFields,
    'ping-target': z.string().optional(),
    'public-ip': z.boolean().optional(),
  })
  .loose();
export type NetworkConfig = z.infer<typeof networkSchema>;
