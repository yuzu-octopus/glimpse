/** Live vs static widget TTL — single source for server cache and client polling. */
export const LIVE_TYPES: Record<string, true> = {
  clock: true,
  weather: true,
  markets: true,
  monitor: true,
  'server-stats': true,
  'system-stats': true,
};
export const LIVE_POLL_MS = 30_000;
export const LIVE_TTL_MS = 60_000;
export const STATIC_TTL_MS = 3_600_000;
