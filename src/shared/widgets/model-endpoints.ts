import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const MODEL_ENDPOINTS_DEFAULTS = { limit: 8 } as const;

export const MODEL_ENDPOINTS_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: 460,
  preferredHeight: 240,
};

/** A table, not a list — the widget loads into aligned columns. */
export const MODEL_ENDPOINTS_SKELETON: SkeletonShape = 'rows';

/** An OpenRouter model slug is `vendor/model`; anything else is a typo worth
 * catching at config load rather than as a silently empty widget. */
const MODEL_SLUG = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][\w.-]*\/[\w.-]+$/, 'expected an OpenRouter model slug like `anthropic/claude-sonnet-4.5`');

/** OpenRouter provider tag — the endpoint `tag`, not the display name. */
const PROVIDER_TAG = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9][\w.-]*$/i, 'expected a provider tag like `azure` or `fireworks`');

export const modelEndpointsSchema = z
  .object({
    type: z.literal('model-endpoints'),
    ...sharedWidgetFields,
    /**
     * The models whose availability this dashboard actually depends on. The
     * catalogue is 458 slugs, so there is no "show everything" default: an
     * explicit list is the filter that keeps the fan-out to a handful of
     * requests.
     */
    models: z.array(MODEL_SLUG).min(1).max(12),
    /** Optional provider tag — keeps only the endpoints served by it
     * (`azure`, `fireworks`, `deepinfra`, …) for every listed model. */
    provider: PROVIDER_TAG.optional(),
    /**
     * Rows rendered. One model can be served by 20+ providers, so the row list
     * is capped; the cap is applied after sorting, so the least healthy
     * endpoints are the ones that survive it.
     */
    limit: z.number().int().min(1).max(100).default(() => MODEL_ENDPOINTS_DEFAULTS.limit),
    /** Only endpoints that are not fully up — the "is a model I depend on
     * degraded?" view. Off by default: an all-healthy dashboard should still
     * show its providers, not an empty card. */
    'unhealthy-only': z.boolean().default(false),
  })
  .loose();

export type ModelEndpointsConfig = z.infer<typeof modelEndpointsSchema>;
