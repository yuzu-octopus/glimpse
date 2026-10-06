/**
 * Per-widget data payload interfaces, shared between the server fetchers
 * (src/server/widgets/*) and the client components (src/client/widgets/*).
 * Kept free of runtime imports so the client can import these types without
 * pulling server code into the bundle.
 */

export interface RssItem {
  title: string;
  url: string;
  published: string | null;
  source: string;
  thumbnail: string | null;
  description: string | null;
  categories: string[];
}

export interface RedditPost {
  title: string;
  url: string;
  commentsUrl: string;
  thumbnail: string | null;
  flair: string | null;
  score: number;
  comments: number;
  ageSeconds: number;
}

export interface HnPost {
  id: number;
  title: string;
  url: string;
  commentsUrl: string;
  score: number;
  comments: number;
  ageSeconds: number;
}

export interface LobsterPost {
  id: number;
  title: string;
  url: string;
  commentsUrl: string;
  score: number;
  comments: number;
  ageSeconds: number;
  tags: string[];
}

export interface Market {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  chart: number[];
}

/** One configured symbol Yahoo would not answer for. Same contract as
 * `VideoSourceIssue`: the symbols that did answer still render, so this rides
 * a StatusDot rather than a Banner. A four-row card from a five-symbol config
 * reads as complete until you know what is missing. */
export interface MarketSourceIssue {
  /** the config entry verbatim — `AAPL`, `^GSPC` */
  symbol: string;
  /** short and human, never a stack: `HTTP 500 for …` */
  reason: string;
}

export interface MarketsData {
  markets: Market[];
  /** empty on a healthy widget — a symbol that works adds no chrome at all */
  issues: MarketSourceIssue[];
}

export interface WeatherNow {
  temp: number | null;
  feelsLike: number | null;
  humidity: number | null;
  code: number | null;
}

export interface WeatherDay {
  date: string;
  code: number | null;
  high: number | null;
  low: number | null;
}

export interface WeatherData {
  location: string;
  /** IANA zone the `daily` dates are calendar days *in* — open-meteo is asked
   * for `timezone=auto`, so a forecast for Tokyo rolls over eight hours before
   * the viewer's does, and "Today" has to be asked in the same zone the dates
   * were counted in. `null` on a payload predating this field, which the
   * renderer reads as the viewer's own zone. */
  timezone: string | null;
  current: WeatherNow;
  daily: WeatherDay[];
}

export interface RadarData {
  /** Display name resolved by geocoding. */
  location: string;
  lat: number;
  lon: number;
  zoom: number;
  /** RainViewer tile URL with `{z}/{x}/{y}` placeholders. */
  tileUrlTemplate: string;
  /** Radar frame time, unix seconds. */
  frameTime: number | null;
}

export interface MonitorSite {
  url: string;
  title: string;
  ok: boolean;
  status: number | null;
  ms: number | null;
  /** link used when the site is down; falls back to url */
  errorUrl: string | null;
  sameTab: boolean;
}

export interface Video {
  title: string;
  url: string;
  channel: string;
  published: string | null;
  thumbnail: string | null;
}

/** One configured channel/playlist that produced nothing after every fallback.
 * A per-source status, not a widget failure: the widget still renders every
 * source that did answer, so this rides a StatusDot rather than a Banner. */
export interface VideoSourceIssue {
  /** the config entry verbatim — `@Fireship`, `UC…`, `PL…` */
  source: string;
  /** short and human, never a stack: `HTTP 404`, `handle not found: @typo` */
  reason: string;
}

export interface VideosData {
  videos: Video[];
  /** empty on a healthy widget — a source that works adds no chrome at all */
  issues: VideoSourceIssue[];
}

export interface CustomApiItem {
  title: string;
  url: string | null;
  description: string | null;
  icon: string | null;
  subtitle: string | null;
  value: string | null;
  image: string | null;
  timestamp: string | null;
}

export interface Release {
  name: string;
  tag: string;
  url: string;
  published: string | null;
  source: 'github' | 'gitlab' | 'codeberg' | 'docker-hub';
  notes?: string | null;
}

export interface RepoPull {
  number: number;
  title: string;
  url: string;
}

export interface RepoCommit {
  /** Abbreviated to 7 characters, the way git and GitHub's own UI show it. */
  sha: string;
  message: string;
  author: string;
  date: string | null;
  url: string;
}

export interface RepositoryData {
  name: string;
  description: string | null;
  stars: number | null;
  url: string;
  pulls: RepoPull[];
  issues: RepoPull[];
  /** Absent unless `commits-limit` is above 0 — glance's default is -1. */
  commits?: RepoCommit[];
}

export interface SystemStatsData {
  cpu: { cores: number; speed: number | null; load: number | null } | null;
  mem: { total: number; used: number; free: number } | null;
  fs: { fs: string; size: number; used: number; use: number; mount: string }[];
  temp: number | null;
  gpu: { model: string; temp: number | null }[];
  battery: { percent: number; status: string; powerW: number | null; health: number | null; onAc: boolean | null; hoursRemaining: number | null } | null;
  uptimeHrs: number | null;
  load1m: number | null;
  fanRpm: number | null;
  gpuLoad: number | null;
}

export interface DockerIcon {
  url: string;
  autoInvert: boolean;
}

export interface DockerContainer {
  name: string;
  image: string;
  state: string;
  stateIcon: 'ok' | 'warn' | 'paused' | 'unknown';
  stateText: string;
  url?: string;
  sameTab?: boolean;
  description?: string;
  icon: DockerIcon;
  children?: DockerContainer[];
}
export type DockerData = DockerContainer[];

export interface DnsStatsSeriesPoint {
  queries: number;
  blocked: number;
  percentBlocked: number;
  percentTotal: number;
}

export interface DnsTopBlockedDomain {
  domain: string;
  percentBlocked: number;
}

export interface DnsStats {
  totalQueries: number;
  blockedPercent: number;
  responseTime: number;
  domainsBlocked: number;
  series: DnsStatsSeriesPoint[];
  timeLabels: string[];
  topBlockedDomains: DnsTopBlockedDomain[];
}

export interface ServerMount {
  path: string;
  used: number;
  total: number;
}

export interface ServerInfo {
  name: string;
  hostname: string;
  platform: string;
  bootTime: string;
  cpu: { name?: string | null; load: number; loadIsAvailable: boolean; temp?: number | null };
  memory: { used: number; total: number; isAvailable: boolean };
  mountpoints: ServerMount[];
  temp?: { main: number | null; isAvailable: boolean };
  gpu?: Array<{ model: string; temp?: number | null }>;
  isReachable: boolean;
}

export interface ServerStatsData {
  servers: ServerInfo[];
}

export interface AiQuotaWindow {
  label: string;
  usedPercent: number;
  windowMinutes: number;
  resetsAt: number;
}

export interface AiQuotaData {
  provider: string;
  plan?: string;
  windows: AiQuotaWindow[];
  balance?: number;
}

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionGraphData {
  username: string;
  days: ContributionDay[];
}

export interface CalendarEvent {
  title: string;
  startISO: string;
  endISO?: string;
  location?: string;
  allDay: boolean;
}

export interface TrendingRepo {
  fullName: string;
  description?: string;
  language?: string;
  stars: number;
  starsToday: number;
  url: string;
}
export type TrendingData = TrendingRepo[];

export interface NetworkData {
  localIp: string;
  publicIp?: string | null;
  /** HTTPS time-to-first-byte to the probe target. Not an ICMP ping: it
   *  includes DNS, TCP, TLS and the server's own response time. */
  ttfbMs?: number | null;
}

export interface ChangeDetectionItem {
  url: string;
  /** True when the content differs from the previous successful fetch. */
  changed: boolean;
  /** ISO timestamp of the last observed change, null when never changed. */
  changedAt: string | null;
  /** Leading excerpt of the new content, present only on a fresh change. */
  diffSnippet?: string;
}
export type ChangeDetectionData = ChangeDetectionItem[];

/**
 * Availability of one OpenRouter endpoint (one provider serving one model).
 * `health` is the derived signal; `status` is the raw upstream code kept for
 * the row tooltip.
 */
export type EndpointHealth = 'up' | 'degraded' | 'down' | 'unknown';

// A type alias, not an interface: the kit's `Table` constrains its row type to
// `Record<string, unknown>`, and only a type alias gets the implicit index
// signature that satisfies it.
export type ModelEndpointRow = {
  /** Model slug, e.g. `anthropic/claude-sonnet-4.5`. */
  model: string;
  modelName: string;
  /** Provider display name, e.g. `Fireworks`. */
  provider: string;
  /** OpenRouter provider tag, e.g. `fireworks/ai-fp8`. */
  tag: string;
  health: EndpointHealth;
  /** Raw OpenRouter endpoint status (0 healthy, negative deranked). */
  status: number | null;
  /** Uptime percentages, null when the upstream has no sample. */
  uptime5m: number | null;
  uptime30m: number | null;
  uptime1d: number | null;
  /** Canonical model page — the row's tappable target. */
  url: string;
};

/** Per-model rollup across every endpoint returned for it. */
export interface ModelEndpointModel {
  model: string;
  name: string;
  /** Worst health among the model's endpoints: what "is this model working?" means. */
  health: EndpointHealth;
  providers: number;
  up: number;
 degraded: number;
  down: number;
  /** True when no endpoint is fully up — the model is unservable as routed. */
  unavailable: boolean;
  url: string;
}

export interface ModelEndpointsData {
  models: ModelEndpointModel[];
  /** Endpoint rows after the provider filter, health filter and `limit` cap. */
  rows: ModelEndpointRow[];
  /** Rows before the `limit` cap, so the UI can say "8 of 27". */
  total: number;
  /** Models configured, and how many of them answered. */
  checked: number;
  requested: number;
  /** Slugs whose request failed — the rest still render. */
  failed: string[];
}

/** Recently-added library item, shared by the immich + jellyfin widgets. */
export interface MediaItem {
  title: string;
  subtitle: string | null;
  /** Direct poster/thumbnail URL on the media instance (may need instance auth in the browser). */
  poster: string | null;
  /** Deep link into the instance web UI. */
  url: string | null;
  date: string | null;
}

export interface MediaData {
  items: MediaItem[];
}

export interface TwitchStream {
  login: string;
  displayName: string;
  title: string;
  gameName: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  profileImageUrl: string | null;
  url: string;
  live: boolean;
}
export type TwitchChannelsData = TwitchStream[];

export interface TwitchGame {
  id: string;
  name: string;
  boxArtUrl: string | null;
  url: string;
}
export type TwitchTopGamesData = TwitchGame[];

/** Single torrent, shared by the qbittorrent + transmission widgets. */
export interface TorrentItem {
  name: string;
  /** 0..1 fraction complete. */
  progress: number;
  state: string;
  size: number | null;
  downloadSpeed: number | null;
  uploadSpeed: number | null;
  /** Seconds remaining, null when unknown/complete. */
  eta: number | null;
}

export interface TorrentData {
  torrents: TorrentItem[];
}

/** One Home Assistant entity, already resolved to something legible: a
 *  `binary_sensor` whose raw state is `on` reads as Closed/Open, a `sensor`
 *  carries its unit. `raw` stays so a config `label` (or a later chart) can
 *  go back to the untouched value. */
export interface HomeAssistantEntity {
  /** The entity_id, e.g. `binary_sensor.front_door` — shown as supporting text. */
  id: string;
  /** friendly_name when HA has one, else the id with the domain stripped. */
  name: string;
  domain: string;
  /** Untouched `state` from the API. Empty when the entity is not in the install. */
  raw: string;
  /** What the row shows — a word for binary domains, `21.5 °C` for sensors. */
  value: string;
  status: HomeAssistantStatus;
  /** True when `value` starts with a number, so the row sets tabular numerals. */
  numeric: boolean;
}

/** `positive` = the state you want to see (closed, on, locked), `negative` =
 *  the one you don't (open, unlocked, problem), `neutral` = neither. */
export type HomeAssistantStatus = 'positive' | 'negative' | 'neutral';

export interface HomeAssistantData {
  entities: HomeAssistantEntity[];
}

/** One tailnet node, already resolved from Tailscale's device DTO. The API
 *  has no `online` field — connectivity is `connectedToControl`, and it is
 *  that flag which decides `online` here. */
export interface TailscaleDevice {
  /** `nodeId` when present (the identifier Tailscale asks you to use), else the legacy `id`. */
  id: string;
  /** Fully-qualified MagicDNS name, e.g. `nas.home.arpa`. Falls back to the hostname. */
  name: string;
  /** Connected to the control plane right now. */
  online: boolean;
  os: string | null;
  clientVersion: string | null;
  /** The 100.64/10 (CGNAT) IPv4 tailnet address, i.e. the one a human reads. */
  address: string | null;
  /** RFC3339 timestamp of the last control-plane contact. Tailscale sends
   *  `null` while a node is connected, so it is only meaningful when offline. */
  lastSeen: string | null;
  /** Has the default route *enabled* (not merely advertised), so it is
   *  actually carrying exit traffic. */
  exitNode: boolean;
}

export interface TailscaleData {
  /** Online nodes first, then offline, each group by name. */
  devices: TailscaleDevice[];
}
