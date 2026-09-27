import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const LOBSTERS_DEFAULTS = { limit: 5 } as const;
export const LOBSTERS_PREF: Pref = { cols: 4, rows: 3, resizable: false, priority: 7, zone: 'main', preferredWidth: null, preferredHeight: null };
export const LOBSTERS_SKELETON: SkeletonShape = 'list';

export const VIDEOS_DEFAULTS = { limit: 5, style: 'grid-cards', channels: [], playlists: [] } as const;
export const VIDEOS_PREF: Pref = { cols: 6, rows: 2, resizable: false, priority: 8, zone: 'main', preferredWidth: 380, preferredHeight: 220 };
export const VIDEOS_SKELETON: SkeletonShape = 'chart';
export const MARKETS_DEFAULTS = {} as const;
export const MARKETS_PREF: Pref = { cols: 3, rows: 1, resizable: false, priority: 7, zone: 'sidebar', preferredWidth: 340, preferredHeight: 220 };
/** One single-line row per symbol (symbol, name, sparkline, change, price). */
export const MARKETS_SKELETON: SkeletonShape = 'rows';
export const MONITOR_DEFAULTS = {} as const;
export const MONITOR_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 200 };
export const MONITOR_SKELETON: SkeletonShape = 'rows';
export const CUSTOM_API_DEFAULTS = { limit: 5 } as const;
export const CUSTOM_API_PREF: Pref = { cols: 3, rows: 1, resizable: false, priority: 5, zone: 'main', preferredWidth: 340, preferredHeight: 200 };
/** Mapped items: an optional thumbnail, a title line and a description line. */
export const CUSTOM_API_SKELETON: SkeletonShape = 'list';
export const REPOSITORY_DEFAULTS = { 'pull-requests-limit': 5, 'issues-limit': 5, 'commits-limit': -1 } as const;
export const REPOSITORY_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 360, preferredHeight: 200 };
/** A repo header plus three sub-lists of single-line link rows. */
export const REPOSITORY_SKELETON: SkeletonShape = 'rows';

export const lobstersSchema = z.object({
  type: z.literal('lobsters'),
  ...sharedWidgetFields,
  'instance-url': z.string().optional(),
  'custom-url': z.string().optional(),
  'sort-by': z.enum(['hot', 'new']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(0).default(LOBSTERS_DEFAULTS.limit),
  'collapse-after': z.number().int().min(-1).optional(),
  'source-header': z.boolean().optional(),
});
export type LobstersConfig = z.infer<typeof lobstersSchema>;

export const videosSchema = z.object({
  type: z.literal('videos'),
  ...sharedWidgetFields,
  channels: z.array(z.string()).default([...VIDEOS_DEFAULTS.channels]),
  playlists: z.array(z.string()).default([...VIDEOS_DEFAULTS.playlists]),
  limit: z.number().int().min(0).default(VIDEOS_DEFAULTS.limit),
  'collapse-after': z.number().int().min(-1).optional(),
  'collapse-after-rows': z.number().int().min(-1).optional(),
  style: z.enum(['horizontal-cards', 'vertical-list', 'grid-cards']).optional(),
  'include-shorts': z.boolean().optional(),
  'video-url-template': z.string().optional(),
});
export type VideosConfig = z.infer<typeof videosSchema>;

export const marketsSchema = z.object({
  type: z.literal('markets'),
  ...sharedWidgetFields,
  markets: z
    .array(
      z.object({
        symbol: z.string(),
        name: z.string().optional(),
        'symbol-link': z.string().optional(),
        'chart-link': z.string().optional(),
      }),
    )
    .min(1),
  'sort-by': z.enum(['change', 'absolute-change']).optional(),
  'symbol-link-template': z.string().optional(),
  'chart-link-template': z.string().optional(),
});
export type MarketsConfig = z.infer<typeof marketsSchema>;

export const monitorSchema = z
  .object({
    type: z.literal('monitor'),
    ...sharedWidgetFields,
    sites: z
      .array(
        z.object({
          url: z.string(),
          title: z.string().optional(),
          /** Resolved by the client with the shared customIconField port
           * (glance widget-monitor.go: Icon), so `si:`/`sh:`/`auto-invert`
           * shorthands work exactly as they do in bookmarks. */
          icon: z.string().optional(),
          'check-url': z.string().optional(),
          'error-url': z.string().optional(),
          timeout: z.string().optional(),
          'allow-insecure': z.boolean().optional(),
          'same-tab': z.boolean().optional(),
          'alt-status-codes': z.array(z.number().int().positive()).optional(),
          'basic-auth': z
            .object({ username: z.string(), password: z.string() })
            .optional(),
          'expected-status-code': z.number().int().positive().optional(), // glimpse extension
        }),
      )
      .optional(),
    // Uptime Kuma pull source: public status-page API, no auth needed.
    'kuma-url': z.string().optional(),
    'kuma-slug': z.string().optional(),
    // Healthchecks push source: Management API v3 list-checks (a read-only
    // project key is enough; pass it via ${HC_API_KEY} interpolation).
    'healthchecks-url': z.string().optional(),
    'healthchecks-key': z.string().optional(),
    'healthchecks-tags': z.array(z.string()).optional(),
    // Allows http:// source URLs (kuma/healthchecks); per-site checks keep
    // their own flag.
    'allow-insecure': z.boolean().optional(),
    'show-failing-only': z.boolean().optional(),
    style: z.enum(['compact']).optional(),
  })
  .superRefine((v, ctx) => {
    const hasSites = (v.sites?.length ?? 0) > 0;
    const hasKuma = v['kuma-url'] !== undefined || v['kuma-slug'] !== undefined;
    const hasHc =
      v['healthchecks-url'] !== undefined ||
      v['healthchecks-key'] !== undefined ||
      (v['healthchecks-tags']?.length ?? 0) > 0;
    if (!hasSites && !hasKuma && !hasHc) {
      ctx.addIssue({
        code: 'custom',
        message: 'monitor: set sites, kuma-url/kuma-slug, or healthchecks-key',
      });
    }
    if (hasKuma && (v['kuma-url'] === undefined || v['kuma-slug'] === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'monitor: kuma-url and kuma-slug must be set together',
      });
    }
    if (
      v['healthchecks-tags'] !== undefined &&
      v['healthchecks-key'] === undefined &&
      v['healthchecks-url'] === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'monitor: healthchecks-tags needs healthchecks-key (or healthchecks-url)',
      });
    }
  });
export type MonitorConfig = z.infer<typeof monitorSchema>;

/** Everything a custom-api request can declare, minus `url` — a subrequest
 * names its own. Shared by the widget body and each subrequests entry so a
 * subrequest supports exactly what the top level does. */
const customApiRequestFields = {
  headers: z.record(z.string(), z.string()).optional(),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
    .optional(),
  body: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  'body-type': z.enum(['json', 'string']).optional(),
  parameters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  'allow-insecure': z.boolean().optional(),
  'skip-json-validation': z.boolean().optional(),
};

export const customApiSchema = z
  .object({
    type: z.literal('custom-api'),
    ...sharedWidgetFields,
    // glance: url and subrequests are both optional, but at least one must be
    // set — enforced in the superRefine below.
    url: z.string().optional(),
    ...customApiRequestFields,
    subrequests: z.record(z.string(), z.object({ url: z.string(), ...customApiRequestFields })).optional(),
    frameless: z.boolean().optional(),
    limit: z.number().int().min(0).default(CUSTOM_API_DEFAULTS.limit),
    'collapse-after': z.number().int().min(-1).optional(),
    options: z
      .object({
        path: z.string(),
        title: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        subtitle: z.string().optional(),
        value: z.string().optional(),
        image: z.string().optional(),
        timestamp: z.string().optional(),
      })
      .default(() => ({ path: '$' })),
  })
  .superRefine((v, ctx) => {
    // An empty map is truthy but names no request, so count entries.
    if (v.url === undefined && Object.keys(v.subrequests ?? {}).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'custom-api: set `url` or at least one `subrequests` entry',
      });
    }
  });
export type CustomApiConfig = z.infer<typeof customApiSchema>;

export const repositorySchema = z.object({
  type: z.literal('repository'),
  ...sharedWidgetFields,
  repository: z.string(),
  // No `token`: the config is served to the browser verbatim. GITHUB_TOKEN
  // (or GH_TOKEN) in the environment is the only source; unset means the
  // public API's anonymous rate limit.
  'pull-requests-limit': z.number().int().positive().default(REPOSITORY_DEFAULTS['pull-requests-limit']),
  'issues-limit': z.number().int().positive().default(REPOSITORY_DEFAULTS['issues-limit']),
  /** Latest commits from the default branch. -1 is glance's default and means
   * "show none", so the extra /commits request is only made when asked for. */
  'commits-limit': z.number().int().min(-1).default(REPOSITORY_DEFAULTS['commits-limit']),
});
export type RepositoryConfig = z.infer<typeof repositorySchema>;
