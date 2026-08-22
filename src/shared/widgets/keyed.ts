import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const LOBSTERS_DEFAULTS = { limit: 5 } as const;
export const LOBSTERS_PREF: Pref = { cols: 4, rows: 3, resizable: false, priority: 7, zone: 'main', preferredWidth: null, preferredHeight: null };

export const VIDEOS_DEFAULTS = { limit: 5, style: 'grid-cards', channels: [], playlists: [] } as const;
export const VIDEOS_PREF: Pref = { cols: 6, rows: 2, resizable: false, priority: 8, zone: 'main', preferredWidth: 380, preferredHeight: 220 };
export const MARKETS_DEFAULTS = {} as const;
export const MARKETS_PREF: Pref = { cols: 3, rows: 1, resizable: false, priority: 7, zone: 'sidebar', preferredWidth: 340, preferredHeight: 220 };
export const MONITOR_DEFAULTS = {} as const;
export const MONITOR_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 340, preferredHeight: 200 };
export const CUSTOM_API_DEFAULTS = { limit: 5 } as const;
export const CUSTOM_API_PREF: Pref = { cols: 3, rows: 1, resizable: false, priority: 5, zone: 'main', preferredWidth: 340, preferredHeight: 200 };
export const REPOSITORY_DEFAULTS = { 'pull-requests-limit': 5, 'issues-limit': 5 } as const;
export const REPOSITORY_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 360, preferredHeight: 200 };

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

export const monitorSchema = z.object({
  type: z.literal('monitor'),
  ...sharedWidgetFields,
  sites: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
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
    .min(1),
  'show-failing-only': z.boolean().optional(),
  style: z.enum(['compact']).optional(),
});
export type MonitorConfig = z.infer<typeof monitorSchema>;

export const customApiSchema = z.object({
  type: z.literal('custom-api'),
  ...sharedWidgetFields,
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
    .optional(),
  body: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  'body-type': z.enum(['json', 'string']).optional(),
  parameters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  frameless: z.boolean().optional(),
  'allow-insecure': z.boolean().optional(),
  'skip-json-validation': z.boolean().optional(),
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
});
export type CustomApiConfig = z.infer<typeof customApiSchema>;

export const repositorySchema = z.object({
  type: z.literal('repository'),
  ...sharedWidgetFields,
  repository: z.string(),
  token: z.string().optional(),
  'pull-requests-limit': z.number().int().positive().default(REPOSITORY_DEFAULTS['pull-requests-limit']),
  'issues-limit': z.number().int().positive().default(REPOSITORY_DEFAULTS['issues-limit']),
});
export type RepositoryConfig = z.infer<typeof repositorySchema>;
