import { z } from 'zod';
import { sharedWidgetFields } from './shared';

const feedSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  limit: z.number().int().min(0).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  'hide-categories': z.boolean().optional(),
  'hide-description': z.boolean().optional(),
});

export const rssSchema = z.object({
  type: z.literal('rss'),
  ...sharedWidgetFields,
  feeds: z.array(feedSchema).min(1),
  limit: z.number().int().min(0).optional(),
  'collapse-after': z.number().int().min(-1).optional(),
  'source-header': z.boolean().optional(),
  style: z
    .enum(['vertical-list', 'detailed-list', 'horizontal-cards', 'horizontal-cards-2'])
    .optional(),
  'thumbnail-height': z.number().int().positive().optional(),
  'card-height': z.number().int().positive().optional(),
  'preserve-order': z.boolean().optional(),
  'single-line-titles': z.boolean().optional(),
});
export type RssConfig = z.infer<typeof rssSchema>;

export const hackerNewsSchema = z.object({
  type: z.literal('hacker-news'),
  ...sharedWidgetFields,
  limit: z.number().int().min(0).optional(),
  'sort-by': z.enum(['top', 'new', 'best']).optional(),
  'extra-sort-by': z.enum(['engagement']).optional(),
  'comments-url-template': z.string().optional(),
  'collapse-after': z.number().int().min(-1).optional(),
  'source-header': z.boolean().optional(),
});
export type HackerNewsConfig = z.infer<typeof hackerNewsSchema>;

export const redditSchema = z.object({
  type: z.literal('reddit'),
  ...sharedWidgetFields,
  subreddit: z.string(),
  'sort-by': z.enum(['hot', 'new', 'top', 'rising']).optional(),
  'top-period': z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(0).optional(),
  'collapse-after': z.number().int().min(-1).optional(),
  'source-header': z.boolean().optional(),
  'show-thumbnails': z.boolean().optional(),
  'show-flairs': z.boolean().optional(),
  style: z.enum(['vertical-list', 'horizontal-cards', 'vertical-cards']).optional(),
  'comments-url-template': z.string().optional(),
  'request-url-template': z.string().optional(),
  proxy: z
    .union([
      z.string(),
      z.object({
        url: z.string(),
        'allow-insecure': z.boolean().optional(),
        timeout: z.string().optional(),
      }),
    ])
    .optional(),
  'extra-sort-by': z.enum(['engagement']).optional(),
  'app-auth': z
    .object({
      name: z.string().optional(),
      id: z.string(),
      secret: z.string(),
    })
    .optional(),
});
export type RedditConfig = z.infer<typeof redditSchema>;

const releaseRepoSchema = z.union([
  // glance forms: "owner/repo", "gitlab:owner/repo", "dockerhub:image[:tag]"
  z.string(),
  z.object({
    url: z.string().optional(),
    repository: z.string().optional(),
    source: z.enum(['github', 'gitlab', 'codeberg', 'docker-hub']).optional(),
    'include-prereleases': z.boolean().optional(),
  }),
]);

export const releasesSchema = z.object({
  type: z.literal('releases'),
  ...sharedWidgetFields,
  repositories: z.array(releaseRepoSchema).min(1),
  'show-source-icon': z.boolean().optional(),
  token: z.string().optional(),
  'gitlab-token': z.string().optional(),
  limit: z.number().int().min(0).optional(),
  'collapse-after': z.number().int().min(-1).optional(),
});
export type ReleasesConfig = z.infer<typeof releasesSchema>;

export const weatherSchema = z.object({
  type: z.literal('weather'),
  ...sharedWidgetFields,
  location: z.string(),
  units: z.enum(['metric', 'imperial']).optional(),
  'hide-location': z.boolean().optional(),
});
export type WeatherConfig = z.infer<typeof weatherSchema>;
