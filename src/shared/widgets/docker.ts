import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const DOCKER_CONTAINERS_DEFAULTS = { 'sock-path': '/var/run/docker.sock' } as const;
export const DOCKER_CONTAINERS_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 220 };

export const dockerContainersSchema = z
  .object({
    type: z.literal('docker-containers'),
    ...sharedWidgetFields,
    /** Docker API endpoint: unix socket path (default) or tcp://host:port / http:// URL. */
    'sock-path': z.string().default(DOCKER_CONTAINERS_DEFAULTS['sock-path']),
    'hide-by-default': z.boolean().optional(),
    'running-only': z.boolean().optional(),
    category: z.string().optional(),
    'format-container-names': z.boolean().optional(),
    /** Per-container label overrides keyed by container name: `glance.<label>: value`. */
    containers: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  })
  .loose();

export type DockerContainersConfig = z.infer<typeof dockerContainersSchema>;
