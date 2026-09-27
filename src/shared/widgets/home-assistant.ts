import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const HOME_ASSISTANT_DEFAULTS = { url: 'http://homeassistant.local:8123' } as const;
export const HOME_ASSISTANT_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 6,
  zone: 'main',
  preferredWidth: 320,
  preferredHeight: 200,
};
export const HOME_ASSISTANT_SKELETON: SkeletonShape = 'rows';

/** One entry per entity: a bare entity id, or an id plus the label the config
 *  wants shown instead of the one derived from the id / friendly name. */
const entityEntry = z.union([
  z.string().min(1),
  z.object({ entity: z.string().min(1), label: z.string().min(1).optional() }),
]);

export const homeAssistantSchema = z
  .object({
    type: z.literal('home-assistant'),
    ...sharedWidgetFields,
    /** Home Assistant base URL — the REST API lives under <url>/api. */
    url: z.string().min(1).default(HOME_ASSISTANT_DEFAULTS.url),
    /** Long-lived access token. Falls back to the HA_TOKEN env var. */
    token: z.string().optional(),
    /** Entities to show, in display order. One `GET /api/states` returns every
     *  entity in the install, so this is filtered server-side — never one
     *  request per entry. */
    entities: z.array(entityEntry).min(1),
  })
  .loose();

export type HomeAssistantConfig = z.infer<typeof homeAssistantSchema>;
export type HomeAssistantEntityEntry = z.infer<typeof entityEntry>;
