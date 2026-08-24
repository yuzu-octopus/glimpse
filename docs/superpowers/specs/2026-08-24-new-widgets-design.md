# New Widgets Design — 2026-08-24

## Goal
Add 5 widgets in one parallel batch to broaden dashboard coverage (visual + data + productivity): `contribution-graph`, `github-trending`, `weather-radar`, `events-calendar`, `network` (formerly bandwidth). All follow existing widget pattern; no new infra.

## Context
Glimpse is Bun+React 19+Astryx SPA, 27 widget types today, YAML `pages→columns→widgets`, Zod schemas in `shared/widgets`, fetchers in `server/widgets`, lazy renderers in `client/widgets`. Pattern: schema + payload + server fetcher + client renderer + preferredSizes + config example.

## Widgets

### 1. contribution-graph
- **Config:** `type: contribution-graph`, `username` (required), `token?` (private contribs), `cache` default `1d`, `limit?` (weeks, default 53)
- **Server:** Fetch `https://github.com/<user>` contributions calendar (scrape `data-level`/`data-date` from contributions SVG) or GraphQL `contributionsCollection`; no token = public only. Return `ContributionDay {date, count, level 0-4}[]`.
- **Client:** GitHub-style grid (53×7), color via `var(--color-primary)` ramp, tooltip, month labels.
- **Errors:** 404 user → error banner; no network → skeleton stale.

### 2. github-trending
- **Config:** `type: github-trending`, `language?`, `since: daily|weekly|monthly` default daily, `limit` default 10
- **Server:** Fetch `https://github.com/trending/<lang>?since=<since>` HTML, parse repo cards (owner/repo, description, language, stars, stars-today). Fallback: `ecosia` trending JSON if HTML parse fails.
- **Client:** Ranked list with language dot, stars today, description, link.

### 3. weather-radar
- **Config:** `type: weather-radar`, `location` (same as weather), `zoom` 3-10 default 7, `cache` 10m
- **Server:** Reuse weather geocode; return `{lat, lon, zoom}` + RainViewer tile URL template `https://tilecache.rainviewer.com/v2/radar/.../{z}/{x}/{y}/2/1_1.png`. No server proxy needed.
- **Client:** OSM base + radar overlay `img` tiles (no Leaflet dep — ponytail: CSS grid of `img` tags). Timestamp of last radar frame.

### 4. events-calendar
- **Config:** `type: events-calendar`, `urls: string[]` (ICS URLs) or `ics-url`, `days` default 14, `limit` 20
- **Server:** Fetch ICS `text/calendar`, parse `VEVENT` (DTSTART/DTEND/SUMMARY/LOCATION/DESCRIPTION), expand RRULE minimally (FREQ=DAILY/WEEKLY count ≤ limit), sort by start, filter past. Return `CalendarEvent {title, start, end, location?}[]`.
- **Client:** Agenda list with day headers (Today/Tomorrow/Mon 25), time range, location. No write.

### 5. network
- **Config:** `type: network`, `ping-target` default `1.1.1.1`, `public-ip: boolean` default true, `cache` 30m (public IP) + live ping 30s
- **Server:** Local IP via `os.networkInterfaces()` first non-internal IPv4; public IP via `https://api.ipify.org?format=json` (cached); ping via `fetchWithRetry` timing to `https://<ping-target>/` (HEAD, measure ms). Return `{localIp, publicIp?, pingMs?}`. Bandwidth: if `system-stats` available reuse; otherwise omit (show —) — v1 no historical throughput.
- **Client:** 4-stat row (Local IP · Public IP · Ping · Status) + ping sparkline (in-memory, 30s poll when page contains network). Poll via existing live mechanism (add `network` to LIVE_TYPES 30s).

## Architecture & Contracts
- Each widget owns `shared/widgets/<slice>.ts` schema, `server/widgets/<name>.ts` fetcher, `client/widgets/<name>/`, `preferredSizes.ts` entry, `config.example.yml` snippet — no file overlap.
- Parallel batch: 5 subagents, contracts upfront, one integration pass (`tsc --noEmit` + `bun run test` + `react-doctor`).
- Naming: kebab-case types as above.

## Testing
One schema test + one fetcher test (fixtures, injected fetch, zero network) + one component test per widget. Cross-cutting: ICS parse, GH trending parse, contributions parse each have edge-case tests.

## Out of scope
- rss-reader/feed-reader (duplicate of `rss` — dropped), package-tracker, sports, portfolio, transit, image-frame (deferred)
- Write-back for events-calendar, Leaflet map deps, private GitHub graph requiring PAT by default
