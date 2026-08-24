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

export interface RepositoryData {
  name: string;
  description: string | null;
  stars: number | null;
  url: string;
  pulls: RepoPull[];
  issues: RepoPull[];
}

export interface SystemStatsData {
  cpu: { cores: number; speed: number | null; load: number | null } | null;
  mem: { total: number; used: number; free: number } | null;
  fs: { fs: string; size: number; used: number; use: number; mount: string }[];
  temp: number | null;
  gpu: { model: string; temp: number | null }[];
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
  error?: string;
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
  pingMs?: number | null;
}
