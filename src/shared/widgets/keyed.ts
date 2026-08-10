import { z } from 'zod';
import { sharedWidgetFields } from './shared';

export const lobstersSchema = z.object({
  type: z.literal('lobsters'),
  ...sharedWidgetFields,
  'instance-url': z.string().optional(),
  'sort-by': z.enum(['hot', 'new']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
});
export type LobstersConfig = z.infer<typeof lobstersSchema>;

export const videosSchema = z.object({
  type: z.literal('videos'),
  ...sharedWidgetFields,
  channels: z.array(z.string()).default([]),
  playlists: z.array(z.string()).default([]),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
  'collapse-after-rows': z.number().optional(),
  style: z.enum(['horizontal-cards', 'vertical-list', 'grid-cards']).optional(),
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
        icon: z.string().optional(),
        'expected-status-code': z.number().optional(),
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
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  body: z.string().optional(),
  'body-type': z.enum(['json', 'string']).optional(),
  parameters: z.record(z.string(), z.string()).optional(),
  frameless: z.boolean().optional(),
  'allow-insecure': z.boolean().optional(),
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
  'pull-requests-limit': z.number().optional(),
  'issues-limit': z.number().optional(),
  'commits-limit': z.number().optional(),
});
export type RepositoryConfig = z.infer<typeof repositorySchema>;

export const twitchChannelsSchema = z.object({
  type: z.literal('twitch-channels'),
  ...sharedWidgetFields,
  channels: z.array(z.string()).min(1),
  'collapse-after': z.number().optional(),
  'sort-by': z.enum(['viewers', 'live']).optional(),
});
export type TwitchChannelsConfig = z.infer<typeof twitchChannelsSchema>;

export const twitchTopGamesSchema = z.object({
  type: z.literal('twitch-top-games'),
  ...sharedWidgetFields,
  exclude: z.array(z.string()).default([]),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
});
export type TwitchTopGamesConfig = z.infer<typeof twitchTopGamesSchema>;
