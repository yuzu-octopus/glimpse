# New Widgets (5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 widgets — contribution-graph, github-trending, weather-radar, events-calendar, network — in one parallel batch with server fetcher + client renderer + schema + tests each.

**Architecture:** Each widget follows existing pattern: Zod schema in `src/shared/widgets/*.ts` + wire payload in `src/shared/widgets/payloads.ts` if needed + server fetcher `src/server/widgets/<name>.ts` via `registerWidget` + client renderer `src/client/widgets/<name>/index.tsx` via `registerWidgetComponent` + lazy entry in `src/client/widgets/index.ts` + `preferredSizes.ts` entry + `config.example.yml` snippet. No new deps; reuse `fetchWithRetry`, `sanitizeUrl`, `Bun.XML`, `os.networkInterfaces`.

**Tech Stack:** Bun, TypeScript 5, React 19, Astryx, Zod v4, Vitest, `vite-plugin-pwa`

## Global Constraints

- No new npm deps (RainViewer tiles via plain `img`, no Leaflet).
- Strict TS: `strict`, `verbatimModuleSyntax`, no `ReturnType` aliases, no inline casts, unconditional hooks.
- Zod v4: `.loose()`, `z.record()` 2 args, `.default(()=>...)`.
- Registries: `src/server/widgets/index.ts` barrel + `src/client/widgets/index.ts` `widgetLoaders` map; `scheduleWidgetPreload` in `main.tsx`.
- Tests: `vitest run` (jsdom, globals), inject `WidgetFetchContext` with fake fetch, zero network; hook tests use `vi.stubGlobal('fetch')`.
- Gates: `bunx tsc --noEmit` clean + `bun run test` green + `npx react-doctor@latest` 100/100 (glance/** ignored).
- Naming: kebab-case widget types; `PREFERRED_SIZES[type]` drives bento.

---

### Task 1: contribution-graph widget

**Files:**
- Create: `src/server/widgets/contribution-graph.ts`
- Create: `src/client/widgets/contribution-graph/index.tsx`
- Create: `src/client/widgets/contribution-graph/contribution-graph.module.css`
- Modify: `src/shared/widgets/feeds.ts` (or `src/shared/widgets/contribution.ts`) — add `ContributionGraphSchema`
- Modify: `src/shared/widgets/index.ts` — wire schema entry
- Modify: `src/shared/widgets/preferredSizes.ts`
- Modify: `src/server/widgets/index.ts` — import fetcher
- Modify: `src/client/widgets/index.ts` — loader entry
- Test: `src/server/widgets/contribution-graph.test.ts`
- Test: `src/client/widgets/contribution-graph/contribution-graph.test.tsx`

**Interfaces:**
- Consumes: `registerWidget`, `WidgetFetchContext`, `fetchWithRetry`
- Produces: `ContributionDay {date: string, count: number, level: 0|1|2|3|4}[]` payload

- [ ] **Step 1: Write schema + wire types**
- [ ] **Step 2: Write failing fetcher test** (fixture: GitHub contributions SVG snippet with `data-date`/`data-level`, mock fetch returns HTML; assert parsed days)
- [ ] **Step 3: Implement fetcher** (`GET https://github.com/${username}` with `Accept: text/html`, parse via regex/DOM `data-date`/`data-level`, throw `sanitizeUrl` on error)
- [ ] **Step 4: Write failing component test** (renders grid cells per day, tooltip)
- [ ] **Step 5: Implement component** (53×7 grid, primary color ramp, responsive)
- [ ] **Step 6: Wire registries + preferredSizes + run `bun run test` subset + commit**

### Task 2: github-trending widget

**Files:**
- Create: `src/server/widgets/github-trending.ts`
- Create: `src/client/widgets/github-trending/index.tsx`
- Modify: `src/shared/widgets/feeds.ts` — `GithubTrendingSchema`
- Modify: `src/shared/widgets/index.ts`, `preferredSizes.ts`, `src/server/widgets/index.ts`, `src/client/widgets/index.ts`
- Test: `src/server/widgets/github-trending.test.ts`
- Test: `src/client/widgets/github-trending/github-trending.test.tsx`

**Interfaces:**
- Consumes: `fetchWithRetry`, `registerWidget`
- Produces: `TrendingRepo {fullName, description, language, stars, starsToday, url}[]`

- [ ] **Step 1: Write schema** (`language?`, `since: daily|weekly|monthly` default daily, `limit` 10)
- [ ] **Step 2: Write failing fetcher test** (fixture: trending HTML fragment with 2 repos; mock fetch)
- [ ] **Step 3: Implement fetcher** (`GET https://github.com/trending/${lang}?since=${since}`, regex parse `article.Box-row` → fields)
- [ ] **Step 4: Write failing component test**
- [ ] **Step 5: Implement component** (ranked list, language dot, stars today)
- [ ] **Step 6: Wire + test + commit**

### Task 3: weather-radar widget

**Files:**
- Create: `src/server/widgets/weather-radar.ts`
- Create: `src/client/widgets/weather-radar/index.tsx`
- Modify: `src/shared/widgets/weather.ts` — `WeatherRadarSchema`
- Modify: `src/shared/widgets/index.ts`, `preferredSizes.ts`, registries
- Test: `src/server/widgets/weather-radar.test.ts`
- Test: `src/client/widgets/weather-radar/weather-radar.test.tsx`

**Interfaces:**
- Consumes: weather geocode helper (reuse `geocodeLocation` from `server/widgets/weather.ts`)
- Produces: `{lat, lon, zoom, tileUrlTemplate}`

- [ ] **Step 1: Schema** (`location`, `zoom` 3-10 default 7)
- [ ] **Step 2: Failing fetcher test** (mock geocode + RainViewer `https://api.rainviewer.com/public/weather-maps.json` returns last frame)
- [ ] **Step 3: Implement fetcher** (geocode → RainViewer frame → tile template)
- [ ] **Step 4: Component test**
- [ ] **Step 5: Component** (OSM base + radar overlay `img` grid, 2×2 tiles for v1, timestamp)
- [ ] **Step 6: Wire + test + commit**


### Task 4: events-calendar widget

**Files:**
- Create: `src/server/widgets/events-calendar.ts`
- Create: `src/client/widgets/events-calendar/index.tsx`
- Modify: `src/shared/widgets/calendar.ts` — `EventsCalendarSchema` (`urls` or `ics-url`, `days`, `limit`)
- Modify: registries, `preferredSizes.ts`
- Test: `src/server/widgets/events-calendar.test.ts` (fixture: minimal ICS with 3 VEVENTs + one RRULE)
- Test: `src/client/widgets/events-calendar/events-calendar.test.tsx`

**Interfaces:**
- Produces: `CalendarEvent {title, start: ISO, end?: ISO, location?}[]` sorted

- [ ] **Step 1: Schema**
- [ ] **Step 2: Failing fetcher test**
- [ ] **Step 3: Implement ICS parser** (split `BEGIN:VEVENT`, parse DTSTART/DTEND/SUMMARY/LOCATION, naive RRULE expansion daily/weekly × count, filter past, sort)
- [ ] **Step 4: Component test**
- [ ] **Step 5: Component** (day headers Today/Tomorrow/Mon 25, time range)
- [ ] **Step 6: Wire + test + commit**

### Task 5: network widget

**Files:**
- Create: `src/server/widgets/network.ts`
- Create: `src/client/widgets/network/index.tsx`
- Create: `src/shared/widgets/network.ts` — `NetworkSchema`
- Modify: `src/shared/widgets/index.ts`, `preferredSizes.ts`, registries, `src/shared/live.ts` (add `network` to poll set 30s or handle via component interval)
- Test: `src/server/widgets/network.test.ts` (mock `os.networkInterfaces` via vitest mock, mock `fetch` for ipify + ping)
- Test: `src/client/widgets/network/network.test.tsx`

**Interfaces:**
- Consumes: `os.networkInterfaces`, `fetchWithRetry`, `api.ipify.org`
- Produces: `{localIp: string, publicIp?: string, pingMs?: number}`

- [ ] **Step 1: Schema** (`ping-target` default `1.1.1.1`, `public-ip` bool default true)
- [ ] **Step 2: Failing fetcher test** (fixtures for ipify JSON + ping timing)
- [ ] **Step 3: Implement fetcher** (local IP first non-internal v4; public IP cached 30m; ping `HEAD https://<target>` timed; `Promise.allSettled`; sanitizeUrl)
- [ ] **Step 4: Component test** (4-stat row, ping sparkline renders past values)
- [ ] **Step 5: Component** (stats row + in-memory ping history sparkline, 30s poll via `setInterval` or `usePageData` live; graceful — if unreachable)
- [ ] **Step 6: Wire + test + commit**

### Task 6: Integration + docs

**Files:**
- Modify: `config.example.yml` — one example per widget
- Modify: `.agents/skills/configuring-glimpse/SKILL.md` — widget cheat sheet rows
- Modify: `README.md` — widgets table
- Modify: `AGENTS.md` — key dirs if needed

- [ ] **Step 1: Run full gates** `bunx tsc --noEmit`, `bun run test`, `npx react-doctor@latest`
- [ ] **Step 2: Fix cross-agent breakage**
- [ ] **Step 3: Update docs + commit**
