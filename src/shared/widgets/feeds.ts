import { z } from 'zod';
import { sharedWidgetFields } from './shared';

const feedSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  limit: z.number().optional(),
  'item-link-prefix': z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const rssSchema = z.object({
  type: z.literal('rss'),
  ...sharedWidgetFields,
  feeds: z.array(feedSchema).min(1),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
  style: z
    .enum(['vertical-list', 'detailed-list', 'horizontal-cards', 'horizontal-cards-2'])
    .optional(),
  'thumbnail-height': z.number().optional(),
  'card-height': z.number().optional(),
  'preserve-order': z.boolean().optional(),
  'single-line-titles': z.boolean().optional(),
});
export type RssConfig = z.infer<typeof rssSchema>;

export const hackerNewsSchema = z.object({
  type: z.literal('hacker-news'),
  ...sharedWidgetFields,
  limit: z.number().optional(),
  'sort-by': z.enum(['top', 'new', 'best']).optional(),
  'extra-sort-by': z.enum(['engagement']).optional(),
  'comments-url-template': z.string().optional(),
});
export type HackerNewsConfig = z.infer<typeof hackerNewsSchema>;

export const redditSchema = z.object({
  type: z.literal('reddit'),
  ...sharedWidgetFields,
  subreddit: z.string(),
  'sort-by': z.enum(['hot', 'new', 'top', 'rising']).optional(),
  'top-period': z.string().optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
  'show-thumbnails': z.boolean().optional(),
  'show-flairs': z.boolean().optional(),
  style: z.enum(['vertical-list', 'horizontal-cards', 'vertical-cards']).optional(),
  'comments-url-template': z.string().optional(),
});
export type RedditConfig = z.infer<typeof redditSchema>;

const releaseRepoSchema = z.object({
  url: z.string().optional(),
  source: z.enum(['github', 'gitlab', 'codeberg', 'docker-hub']).optional(),
});

export const releasesSchema = z.object({
  type: z.literal('releases'),
  ...sharedWidgetFields,
  repositories: z.array(releaseRepoSchema).min(1),
  'show-source-icon': z.boolean().optional(),
  token: z.string().optional(),
  'gitlab-token': z.string().optional(),
  limit: z.number().optional(),
  'collapse-after': z.number().optional(),
});
export type ReleasesConfig = z.infer<typeof releasesSchema>;

export const weatherSchema = z.object({
  type: z.literal('weather'),
  ...sharedWidgetFields,
  location: z.string(),
  units: z.enum(['metric', 'imperial']).optional(),
  'hour-format': z.enum(['12h', '24h']).optional(),
  'hide-location': z.boolean().optional(),
  'show-area-name': z.boolean().optional(),
});
export type WeatherConfig = z.infer<typeof weatherSchema>;
