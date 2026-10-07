import { z } from "zod";
import { AI_QUOTA_PREF, AI_QUOTA_SKELETON, aiQuotaSchema } from "./ai-quota";
import { withTypeAliases } from "./aliases";
import { BOOKMARKS_PREF, BOOKMARKS_SKELETON, bookmarksSchema } from "./bookmarks";
import {
	CALENDAR_PREF,
	CALENDAR_SKELETON,
	calendarSchema,
	EVENTS_CALENDAR_PREF,
	EVENTS_CALENDAR_SKELETON,
	eventsCalendarSchema,
} from "./calendar";
import {
	CHANGE_DETECTION_PREF,
	CHANGE_DETECTION_SKELETON,
	changeDetectionSchema,
} from "./change-detection";
import { CLOCK_PREF, CLOCK_SKELETON, clockSchema } from "./clock";
import {
	CONTRIBUTION_GRAPH_PREF,
	CONTRIBUTION_GRAPH_SKELETON,
	contributionGraphSchema,
} from "./contribution";
import { DNS_STATS_PREF, DNS_STATS_SKELETON, dnsStatsSchema } from "./dns";
import {
	DOCKER_CONTAINERS_PREF,
	DOCKER_CONTAINERS_SKELETON,
	dockerContainersSchema,
} from "./docker";
import {
	HACKER_NEWS_PREF,
	HACKER_NEWS_SKELETON,
	hackerNewsSchema,
	REDDIT_PREF,
	REDDIT_SKELETON,
	RELEASES_PREF,
	RELEASES_SKELETON,
	RSS_PREF,
	RSS_SKELETON,
	redditSchema,
	releasesSchema,
	rssSchema,
	WEATHER_PREF,
	WEATHER_SKELETON,
	weatherSchema,
} from "./feeds";
import { githubTrendingSchema, TRENDING_PREF, TRENDING_SKELETON } from "./github-trending";
import {
	GROUP_PREF,
	GROUP_SKELETON,
	groupSchema,
	SPLIT_COLUMN_PREF,
	SPLIT_COLUMN_SKELETON,
	setWidgetSchemaRef,
	splitColumnSchema,
} from "./group";
import {
	HOME_ASSISTANT_PREF,
	HOME_ASSISTANT_SKELETON,
	homeAssistantSchema,
} from "./home-assistant";
import {
	HTML_PREF,
	HTML_SKELETON,
	htmlSchema,
	IFRAME_PREF,
	IFRAME_SKELETON,
	iframeSchema,
} from "./iframe";
import {
	CUSTOM_API_PREF,
	CUSTOM_API_SKELETON,
	customApiSchema,
	LOBSTERS_PREF,
	LOBSTERS_SKELETON,
	lobstersSchema,
	MARKETS_PREF,
	MARKETS_SKELETON,
	MONITOR_PREF,
	MONITOR_SKELETON,
	marketsSchema,
	monitorSchema,
	REPOSITORY_PREF,
	REPOSITORY_SKELETON,
	repositorySchema,
	VIDEOS_PREF,
	VIDEOS_SKELETON,
	videosSchema,
} from "./keyed";
import {
	IMMICH_PREF,
	IMMICH_SKELETON,
	immichSchema,
	JELLYFIN_PREF,
	JELLYFIN_SKELETON,
	jellyfinSchema,
	QBITTORRENT_PREF,
	QBITTORRENT_SKELETON,
	qbittorrentSchema,
	TRANSMISSION_PREF,
	TRANSMISSION_SKELETON,
	transmissionSchema,
} from "./media";
import {
	MODEL_ENDPOINTS_PREF,
	MODEL_ENDPOINTS_SKELETON,
	modelEndpointsSchema,
} from "./model-endpoints";
import { NETWORK_PREF, NETWORK_SKELETON, networkSchema } from "./network";
import { NOTEPAD_PREF, NOTEPAD_SKELETON, notepadSchema } from "./notepad";
import { RADAR_PREF, RADAR_SKELETON, radarSchema } from "./radar";
import { SEARCH_PREF, SEARCH_SKELETON, searchSchema } from "./search";
import { SERVER_STATS_PREF, SERVER_STATS_SKELETON, serverStatsSchema } from "./server-stats";
import type { Pref, SkeletonShape } from "./shared";
import { SYSTEM_STATS_PREF, SYSTEM_STATS_SKELETON, systemStatsSchema } from "./system-stats";
import { TAILSCALE_PREF, TAILSCALE_SKELETON, tailscaleSchema } from "./tailscale";
import { TIMER_PREF, TIMER_SKELETON, timerSchema } from "./timer";
import { TODO_PREF, TODO_SKELETON, todoSchema } from "./todo";
import {
	TWITCH_CHANNELS_PREF,
	TWITCH_CHANNELS_SKELETON,
	TWITCH_TOP_GAMES_PREF,
	TWITCH_TOP_GAMES_SKELETON,
	twitchChannelsSchema,
	twitchTopGamesSchema,
} from "./twitch";

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
	homeAssistantSchema,
	modelEndpointsSchema,
	tailscaleSchema,
] as const;

/** Co-located widget metadata: each row pairs the schema with its bento pref
 * + loading skeleton (both declared beside the schema in its own file).
 * PREFERRED_SIZES / SKELETON_SHAPE derive from this table; the derivation
 * test fails if a union member has no row here. */
export const widgetMeta = {
	notepad: {
		schema: notepadSchema,
		pref: NOTEPAD_PREF,
		skeleton: NOTEPAD_SKELETON,
		configOnly: true,
	},
	timer: { schema: timerSchema, pref: TIMER_PREF, skeleton: TIMER_SKELETON, configOnly: true },
	bookmarks: {
		schema: bookmarksSchema,
		pref: BOOKMARKS_PREF,
		skeleton: BOOKMARKS_SKELETON,
		configOnly: true,
	},
	search: { schema: searchSchema, pref: SEARCH_PREF, skeleton: SEARCH_SKELETON, configOnly: true },
	clock: { schema: clockSchema, pref: CLOCK_PREF, skeleton: CLOCK_SKELETON, configOnly: true },
	calendar: {
		schema: calendarSchema,
		pref: CALENDAR_PREF,
		skeleton: CALENDAR_SKELETON,
		configOnly: true,
	},
	"events-calendar": {
		schema: eventsCalendarSchema,
		pref: EVENTS_CALENDAR_PREF,
		skeleton: EVENTS_CALENDAR_SKELETON,
	},
	todo: { schema: todoSchema, pref: TODO_PREF, skeleton: TODO_SKELETON, configOnly: true },
	iframe: { schema: iframeSchema, pref: IFRAME_PREF, skeleton: IFRAME_SKELETON, configOnly: true },
	html: { schema: htmlSchema, pref: HTML_PREF, skeleton: HTML_SKELETON, configOnly: true },
	rss: { schema: rssSchema, pref: RSS_PREF, skeleton: RSS_SKELETON },
	"hacker-news": {
		schema: hackerNewsSchema,
		pref: HACKER_NEWS_PREF,
		skeleton: HACKER_NEWS_SKELETON,
	},
	reddit: { schema: redditSchema, pref: REDDIT_PREF, skeleton: REDDIT_SKELETON },
	group: { schema: groupSchema, pref: GROUP_PREF, skeleton: GROUP_SKELETON, configOnly: true },
	"split-column": {
		schema: splitColumnSchema,
		pref: SPLIT_COLUMN_PREF,
		skeleton: SPLIT_COLUMN_SKELETON,
		configOnly: true,
	},
	releases: { schema: releasesSchema, pref: RELEASES_PREF, skeleton: RELEASES_SKELETON },
	weather: { schema: weatherSchema, pref: WEATHER_PREF, skeleton: WEATHER_SKELETON },
	lobsters: { schema: lobstersSchema, pref: LOBSTERS_PREF, skeleton: LOBSTERS_SKELETON },
	videos: { schema: videosSchema, pref: VIDEOS_PREF, skeleton: VIDEOS_SKELETON },
	markets: { schema: marketsSchema, pref: MARKETS_PREF, skeleton: MARKETS_SKELETON },
	monitor: { schema: monitorSchema, pref: MONITOR_PREF, skeleton: MONITOR_SKELETON },
	"custom-api": { schema: customApiSchema, pref: CUSTOM_API_PREF, skeleton: CUSTOM_API_SKELETON },
	repository: { schema: repositorySchema, pref: REPOSITORY_PREF, skeleton: REPOSITORY_SKELETON },
	"system-stats": {
		schema: systemStatsSchema,
		pref: SYSTEM_STATS_PREF,
		skeleton: SYSTEM_STATS_SKELETON,
	},
	"docker-containers": {
		schema: dockerContainersSchema,
		pref: DOCKER_CONTAINERS_PREF,
		skeleton: DOCKER_CONTAINERS_SKELETON,
	},
	"dns-stats": { schema: dnsStatsSchema, pref: DNS_STATS_PREF, skeleton: DNS_STATS_SKELETON },
	"server-stats": {
		schema: serverStatsSchema,
		pref: SERVER_STATS_PREF,
		skeleton: SERVER_STATS_SKELETON,
	},
	"ai-quota": { schema: aiQuotaSchema, pref: AI_QUOTA_PREF, skeleton: AI_QUOTA_SKELETON },
	"contribution-graph": {
		schema: contributionGraphSchema,
		pref: CONTRIBUTION_GRAPH_PREF,
		skeleton: CONTRIBUTION_GRAPH_SKELETON,
	},
	"weather-radar": { schema: radarSchema, pref: RADAR_PREF, skeleton: RADAR_SKELETON },
	"github-trending": {
		schema: githubTrendingSchema,
		pref: TRENDING_PREF,
		skeleton: TRENDING_SKELETON,
	},
	network: { schema: networkSchema, pref: NETWORK_PREF, skeleton: NETWORK_SKELETON },
	"change-detection": {
		schema: changeDetectionSchema,
		pref: CHANGE_DETECTION_PREF,
		skeleton: CHANGE_DETECTION_SKELETON,
	},
	immich: { schema: immichSchema, pref: IMMICH_PREF, skeleton: IMMICH_SKELETON },
	jellyfin: { schema: jellyfinSchema, pref: JELLYFIN_PREF, skeleton: JELLYFIN_SKELETON },
	qbittorrent: {
		schema: qbittorrentSchema,
		pref: QBITTORRENT_PREF,
		skeleton: QBITTORRENT_SKELETON,
	},
	transmission: {
		schema: transmissionSchema,
		pref: TRANSMISSION_PREF,
		skeleton: TRANSMISSION_SKELETON,
	},
	"twitch-channels": {
		schema: twitchChannelsSchema,
		pref: TWITCH_CHANNELS_PREF,
		skeleton: TWITCH_CHANNELS_SKELETON,
	},
	"twitch-top-games": {
		schema: twitchTopGamesSchema,
		pref: TWITCH_TOP_GAMES_PREF,
		skeleton: TWITCH_TOP_GAMES_SKELETON,
	},
	"home-assistant": {
		schema: homeAssistantSchema,
		pref: HOME_ASSISTANT_PREF,
		skeleton: HOME_ASSISTANT_SKELETON,
	},
	"model-endpoints": {
		schema: modelEndpointsSchema,
		pref: MODEL_ENDPOINTS_PREF,
		skeleton: MODEL_ENDPOINTS_SKELETON,
	},
	tailscale: { schema: tailscaleSchema, pref: TAILSCALE_PREF, skeleton: TAILSCALE_SKELETON },
} as const satisfies Record<
	string,
	{ schema: z.ZodType; pref: Pref; skeleton: SkeletonShape; configOnly?: true }
>;

/**
 * Widget types the server never fetches for: pure config-driven renderers
 * plus the container types. Their payload is `data: null` by design, so a
 * render layer that reads `data == null` as "still loading" shows them a
 * skeleton that can never resolve. Derived from the same registry row as
 * the schema, so a type cannot be added here and forgotten there.
 */
export const CONFIG_ONLY: Record<string, true> = Object.fromEntries(
	Object.entries(widgetMeta)
		.filter(([, m]) => "configOnly" in m)
		.map(([t]) => [t, true]),
);

/** Public widget type union, derived from the schema entries. */
export type WidgetType = (typeof schemaEntries)[number]["shape"]["type"]["value"];

export const WidgetSchema = z.discriminatedUnion("type", schemaEntries);
export type WidgetConfig = z.infer<typeof WidgetSchema>;

// Wire the recursive container reference now that the union exists. Children
// resolve to the alias-aware union too, so a glance type nested in a group or
// split-column folds to its canonical name on the way in.
export const WidgetSchemaInput = withTypeAliases(WidgetSchema);
setWidgetSchemaRef(WidgetSchemaInput);
