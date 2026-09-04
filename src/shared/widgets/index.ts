import { z } from 'zod';
import { bookmarksSchema, BOOKMARKS_PREF, BOOKMARKS_SKELETON } from './bookmarks';
import {
  calendarSchema,
  eventsCalendarSchema,
  CALENDAR_PREF,
  CALENDAR_SKELETON,
  EVENTS_CALENDAR_PREF,
  EVENTS_CALENDAR_SKELETON,
} from './calendar';
import { clockSchema, CLOCK_PREF, CLOCK_SKELETON } from './clock';
import { dockerContainersSchema, DOCKER_CONTAINERS_PREF, DOCKER_CONTAINERS_SKELETON } from './docker';
import { dnsStatsSchema, DNS_STATS_PREF, DNS_STATS_SKELETON } from './dns';
import { contributionGraphSchema, CONTRIBUTION_GRAPH_PREF, CONTRIBUTION_GRAPH_SKELETON } from './contribution';
import {
  hackerNewsSchema,
  redditSchema,
  releasesSchema,
  rssSchema,
  weatherSchema,
  HACKER_NEWS_PREF,
  HACKER_NEWS_SKELETON,
  REDDIT_PREF,
  REDDIT_SKELETON,
  RELEASES_PREF,
  RELEASES_SKELETON,
  RSS_PREF,
  RSS_SKELETON,
  WEATHER_PREF,
  WEATHER_SKELETON,
} from './feeds';
import {
  groupSchema,
  setWidgetSchemaRef,
  splitColumnSchema,
  GROUP_PREF,
  GROUP_SKELETON,
  SPLIT_COLUMN_PREF,
  SPLIT_COLUMN_SKELETON,
} from './group';
import {
  htmlSchema,
  iframeSchema,
  HTML_PREF,
  HTML_SKELETON,
  IFRAME_PREF,
  IFRAME_SKELETON,
} from './iframe';
import {
  customApiSchema,
  lobstersSchema,
  marketsSchema,
  monitorSchema,
  repositorySchema,
  videosSchema,
  CUSTOM_API_PREF,
  CUSTOM_API_SKELETON,
  LOBSTERS_PREF,
  LOBSTERS_SKELETON,
  MARKETS_PREF,
  MARKETS_SKELETON,
  MONITOR_PREF,
  MONITOR_SKELETON,
  REPOSITORY_PREF,
  REPOSITORY_SKELETON,
  VIDEOS_PREF,
  VIDEOS_SKELETON,
} from './keyed';
import { searchSchema, SEARCH_PREF, SEARCH_SKELETON } from './search';
import { serverStatsSchema, SERVER_STATS_PREF, SERVER_STATS_SKELETON } from './server-stats';
import { systemStatsSchema, SYSTEM_STATS_PREF, SYSTEM_STATS_SKELETON } from './system-stats';
import { notepadSchema, NOTEPAD_PREF, NOTEPAD_SKELETON } from './notepad';
import { timerSchema, TIMER_PREF, TIMER_SKELETON } from './timer';
import { todoSchema, TODO_PREF, TODO_SKELETON } from './todo';
import { radarSchema, RADAR_PREF, RADAR_SKELETON } from './radar';
import { githubTrendingSchema, TRENDING_PREF, TRENDING_SKELETON } from './github-trending';
import { networkSchema, NETWORK_PREF, NETWORK_SKELETON } from './network';
import { aiQuotaSchema, AI_QUOTA_PREF, AI_QUOTA_SKELETON } from './ai-quota';
import { changeDetectionSchema, CHANGE_DETECTION_PREF, CHANGE_DETECTION_SKELETON } from './change-detection';
import { twitchChannelsSchema, twitchTopGamesSchema, TWITCH_CHANNELS_PREF, TWITCH_CHANNELS_SKELETON, TWITCH_TOP_GAMES_PREF, TWITCH_TOP_GAMES_SKELETON } from './twitch';
import {
  immichSchema,
  jellyfinSchema,
  qbittorrentSchema,
  transmissionSchema,
  IMMICH_PREF,
  IMMICH_SKELETON,
  JELLYFIN_PREF,
  JELLYFIN_SKELETON,
  QBITTORRENT_PREF,
  QBITTORRENT_SKELETON,
  TRANSMISSION_PREF,
  TRANSMISSION_SKELETON,
} from './media';
import type { Pref, SkeletonShape } from './shared';

const schemaEntries = [
  notepadSchema,
  timerSchema,
  bookmarksSchema,
  searchSchema,
  clockSchema,
  calendarSchema,
  eventsCalendarSchema,
  todoSchema,
  iframeSchema,
  htmlSchema,
  rssSchema,
  hackerNewsSchema,
  redditSchema,
  groupSchema,
  splitColumnSchema,
  releasesSchema,
  weatherSchema,
  lobstersSchema,
  videosSchema,
  marketsSchema,
  monitorSchema,
  customApiSchema,
  repositorySchema,
  systemStatsSchema,
  dockerContainersSchema,
  dnsStatsSchema,
  serverStatsSchema,
  aiQuotaSchema,
  contributionGraphSchema,
  radarSchema,
  githubTrendingSchema,
  networkSchema,
  changeDetectionSchema,
  immichSchema,
  jellyfinSchema,
  qbittorrentSchema,
  transmissionSchema,
  twitchChannelsSchema,
  twitchTopGamesSchema,
] as const;

/** Co-located widget metadata: each row pairs the schema with its bento pref
 * + loading skeleton (both declared beside the schema in its own file).
 * PREFERRED_SIZES / SKELETON_SHAPE derive from this table; the derivation
 * test fails if a union member has no row here. */
export const widgetMeta = {
  notepad: { schema: notepadSchema, pref: NOTEPAD_PREF, skeleton: NOTEPAD_SKELETON },
  timer: { schema: timerSchema, pref: TIMER_PREF, skeleton: TIMER_SKELETON },
  bookmarks: { schema: bookmarksSchema, pref: BOOKMARKS_PREF, skeleton: BOOKMARKS_SKELETON },
  search: { schema: searchSchema, pref: SEARCH_PREF, skeleton: SEARCH_SKELETON },
  clock: { schema: clockSchema, pref: CLOCK_PREF, skeleton: CLOCK_SKELETON },
  calendar: { schema: calendarSchema, pref: CALENDAR_PREF, skeleton: CALENDAR_SKELETON },
  'events-calendar': { schema: eventsCalendarSchema, pref: EVENTS_CALENDAR_PREF, skeleton: EVENTS_CALENDAR_SKELETON },
  todo: { schema: todoSchema, pref: TODO_PREF, skeleton: TODO_SKELETON },
  iframe: { schema: iframeSchema, pref: IFRAME_PREF, skeleton: IFRAME_SKELETON },
  html: { schema: htmlSchema, pref: HTML_PREF, skeleton: HTML_SKELETON },
  rss: { schema: rssSchema, pref: RSS_PREF, skeleton: RSS_SKELETON },
  'hacker-news': { schema: hackerNewsSchema, pref: HACKER_NEWS_PREF, skeleton: HACKER_NEWS_SKELETON },
  reddit: { schema: redditSchema, pref: REDDIT_PREF, skeleton: REDDIT_SKELETON },
  group: { schema: groupSchema, pref: GROUP_PREF, skeleton: GROUP_SKELETON },
  'split-column': { schema: splitColumnSchema, pref: SPLIT_COLUMN_PREF, skeleton: SPLIT_COLUMN_SKELETON },
  releases: { schema: releasesSchema, pref: RELEASES_PREF, skeleton: RELEASES_SKELETON },
  weather: { schema: weatherSchema, pref: WEATHER_PREF, skeleton: WEATHER_SKELETON },
  lobsters: { schema: lobstersSchema, pref: LOBSTERS_PREF, skeleton: LOBSTERS_SKELETON },
  videos: { schema: videosSchema, pref: VIDEOS_PREF, skeleton: VIDEOS_SKELETON },
  markets: { schema: marketsSchema, pref: MARKETS_PREF, skeleton: MARKETS_SKELETON },
  monitor: { schema: monitorSchema, pref: MONITOR_PREF, skeleton: MONITOR_SKELETON },
  'custom-api': { schema: customApiSchema, pref: CUSTOM_API_PREF, skeleton: CUSTOM_API_SKELETON },
  repository: { schema: repositorySchema, pref: REPOSITORY_PREF, skeleton: REPOSITORY_SKELETON },
  'system-stats': { schema: systemStatsSchema, pref: SYSTEM_STATS_PREF, skeleton: SYSTEM_STATS_SKELETON },
  'docker-containers': { schema: dockerContainersSchema, pref: DOCKER_CONTAINERS_PREF, skeleton: DOCKER_CONTAINERS_SKELETON },
  'dns-stats': { schema: dnsStatsSchema, pref: DNS_STATS_PREF, skeleton: DNS_STATS_SKELETON },
  'server-stats': { schema: serverStatsSchema, pref: SERVER_STATS_PREF, skeleton: SERVER_STATS_SKELETON },
  'ai-quota': { schema: aiQuotaSchema, pref: AI_QUOTA_PREF, skeleton: AI_QUOTA_SKELETON },
  'contribution-graph': { schema: contributionGraphSchema, pref: CONTRIBUTION_GRAPH_PREF, skeleton: CONTRIBUTION_GRAPH_SKELETON },
  'weather-radar': { schema: radarSchema, pref: RADAR_PREF, skeleton: RADAR_SKELETON },
  'github-trending': { schema: githubTrendingSchema, pref: TRENDING_PREF, skeleton: TRENDING_SKELETON },
  network: { schema: networkSchema, pref: NETWORK_PREF, skeleton: NETWORK_SKELETON },
  'change-detection': { schema: changeDetectionSchema, pref: CHANGE_DETECTION_PREF, skeleton: CHANGE_DETECTION_SKELETON },
  immich: { schema: immichSchema, pref: IMMICH_PREF, skeleton: IMMICH_SKELETON },
  jellyfin: { schema: jellyfinSchema, pref: JELLYFIN_PREF, skeleton: JELLYFIN_SKELETON },
  qbittorrent: { schema: qbittorrentSchema, pref: QBITTORRENT_PREF, skeleton: QBITTORRENT_SKELETON },
  transmission: { schema: transmissionSchema, pref: TRANSMISSION_PREF, skeleton: TRANSMISSION_SKELETON },
  'twitch-channels': { schema: twitchChannelsSchema, pref: TWITCH_CHANNELS_PREF, skeleton: TWITCH_CHANNELS_SKELETON },
  'twitch-top-games': { schema: twitchTopGamesSchema, pref: TWITCH_TOP_GAMES_PREF, skeleton: TWITCH_TOP_GAMES_SKELETON },
} as const satisfies Record<string, { schema: z.ZodType; pref: Pref; skeleton: SkeletonShape }>;

/** Public widget type union, derived from the schema entries. */
export type WidgetType = (typeof schemaEntries)[number]['shape']['type']['value'];

export const WidgetSchema = z.discriminatedUnion('type', schemaEntries);
export type WidgetConfig = z.infer<typeof WidgetSchema>;

// Wire the recursive container reference now that the union exists.
setWidgetSchemaRef(WidgetSchema);
