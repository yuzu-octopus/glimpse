import type { WidgetType } from './index';
import { BOOKMARKS_PREF } from './bookmarks';
import { CALENDAR_PREF } from './calendar';
import { CLOCK_PREF } from './clock';
import { DOCKER_CONTAINERS_PREF } from './docker';
import { DNS_STATS_PREF } from './dns';
import {
  HACKER_NEWS_PREF,
  REDDIT_PREF,
  RELEASES_PREF,
  RSS_PREF,
  WEATHER_PREF,
} from './feeds';
import { GROUP_PREF, SPLIT_COLUMN_PREF } from './group';
import { HTML_PREF, IFRAME_PREF } from './iframe';
import {
  CUSTOM_API_PREF,
  LOBSTERS_PREF,
  MARKETS_PREF,
  MONITOR_PREF,
  REPOSITORY_PREF,
  VIDEOS_PREF,
} from './keyed';
import { SEARCH_PREF } from './search';
import { SERVER_STATS_PREF } from './server-stats';
import { SYSTEM_STATS_PREF } from './system-stats';
import { TODO_PREF } from './todo';
import type { Pref } from './shared';

export const PREFERRED_SIZES: Record<WidgetType, Pref> = {
  clock: CLOCK_PREF,
  weather: WEATHER_PREF,
  calendar: CALENDAR_PREF,
  bookmarks: BOOKMARKS_PREF,
  search: SEARCH_PREF,
  todo: TODO_PREF,
  rss: RSS_PREF,
  'hacker-news': HACKER_NEWS_PREF,
  reddit: REDDIT_PREF,
  lobsters: LOBSTERS_PREF,
  releases: RELEASES_PREF,
  videos: VIDEOS_PREF,
  markets: MARKETS_PREF,
  monitor: MONITOR_PREF,
  repository: REPOSITORY_PREF,
  'custom-api': CUSTOM_API_PREF,
  iframe: IFRAME_PREF,
  html: HTML_PREF,
  group: GROUP_PREF,
  'split-column': SPLIT_COLUMN_PREF,
  'system-stats': SYSTEM_STATS_PREF,
  'docker-containers': DOCKER_CONTAINERS_PREF,
  'dns-stats': DNS_STATS_PREF,
  'server-stats': SERVER_STATS_PREF,
};

/** Skeleton silhouette per widget type (WidgetChrome loading state). */
export const SKELETON_SHAPE: Record<string, 'list' | 'stat' | 'chart' | 'rows'> = {
  rss: 'list', 'hacker-news': 'list', lobsters: 'list', reddit: 'list', releases: 'list',
  clock: 'stat', weather: 'stat', markets: 'stat', 'server-stats': 'stat',
  'system-stats': 'stat', repository: 'stat',
  videos: 'chart', 'custom-api': 'chart',
};
// anything absent -> 'rows'

export function assertAllWidgetsCovered(widgetTypes: string[]): void {
  const missing = widgetTypes.filter((t) => !(t in PREFERRED_SIZES));
  if (missing.length > 0) {
    throw new Error(`PREFERRED_SIZES missing entries for: ${missing.join(', ')}`);
  }
}
