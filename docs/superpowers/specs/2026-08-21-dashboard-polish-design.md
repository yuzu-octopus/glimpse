# Dashboard Polish & Compositor Upgrade — Design Spec

**Date:** 2026-08-21  
**Status:** Draft — awaiting user review before plan  
**Branch:** `main` — recent base `46e22ae` (page load/refresh optimisation)  
**Spec for:** `skill://writing-plans` next

## 1. Overview & Goals

Glimpse is Bun+React+Astryx flat dashboard cloning glance's YAML + widget semantics but with server-side fetch and richer client tiling. This polish pass closes 4 small UX gaps you flagged on `localhost:3000` plus two research tracks you asked to run first (component ideas + collage compositor squared-error).

**In scope (7 sub-projects, 1 spec → 1 plan):**
1. Feed `Show more/less` — `Show less` must *not* be sticky (scroll like `Show more`)
2. Minecraft videos — cap to 3 in config (no card resize)
3. Remove all `twitch` (both `twitch-channels` + `twitch-top-games`) from code + config — replace slot later from new ideas
4. Search default → `new-tab: true` configurable, `target` still honored
5. Homelab real stats — ensure CPU/RAM/disk/temp/GPU works without a real homelab (graceful fallback); pick `systeminformation` after web_search
6. **Research 6:** component brainstorm across categories — steal ideas from other dashboards/UI libs (completed via scout, 12 proposals)
7. **Research 7:** collage compositor upgrade — every widget declares `preferredWidth/Height|null` + `resizable`, compositor picks `n = argmin Σ(actualWidth(n)-prefW)²` (completed via scout)

Out of scope: full widget implementations for 6 (just research doc + one placeholder replacement), live GPU data without a lab, contrast multipliers.

## 2. Research Summaries

### 2.1 Component Brainstorm (scout `ComponentBrainstorm`)

Audited 22 existing types in `src/shared/widgets/index.ts`. Existing coverage: feeds (rss/hn/reddit/lobsters/releases/videos), homelab-lite (monitor), finance-lite (markets), dev-lite (repository/custom-api), productivity-lite (todo/calendar/bookmarks/clock/weather), extensibility (iframe/html/group/split-column), with gaps vs glance (server-stats, docker, dns-stats, changedetection) and vs community dashboards.

Stealable layouts:
- **Bento Grid** (shadcn/ui dashboard-01, shadcn-ui-blocks) — asymmetric `grid` with `span-2`, 1px border, fits flat.
- **Sparkline KPI** (Tremor/Recharts) — value + delta badge + 40px mini line, no axes.
- **Calendar Heatmap** (Nivo→ECharts) — 5-step palette, square cells.

12 proposals (priority order scout suggested: DNS Stats > Markets+ > Server Stats > Docker > …):

*Productivity:* Focus Timer+Habit Streak (pomodoro + heatmap, localStorage), Unified Inbox Digest (Gmail/Outlook unread, Homepage parity), Scratch Notes (autosave markdown).

*Dev/Code:* CI Pipeline — GitHub Actions workflow dots+duration; Docker Containers — name/status/uptime/sparkline via Docker Engine API (glance parity); Server Stats + Uptime Sparkline — CPU/RAM/disk + 24h sparkline via `systeminformation`/Node exporter/Glances.

*Homelab/Infra:* DNS Stats — Pi-hole/AdGuard queries/blocked/top domains; Media Stack — Jellyfin/Plex/Immich recently added + active streams; ChangeDetection Watcher — watched URLs diff age.

*Finance:* Markets+ Sparklines & Holdings — price + 7d sparkline + holdings (enhance existing markets).

*Fun:* APOD + Quote Bento — hero image + quote + mini calendar; Scoreboard — sports/F1/UFC live scores.

Full markdown at `./component-ideas.md` (2828 B, ephemeral) — will be copied into `docs/superpowers/specs/component-ideas-appendix.md` or inlined below.

### 2.2 Collage Compositor (scout `CollageResearch`)

Current: 3 modes via `getTilingProps` seam → `tiling.ts` + `page.module.css` + `useCollageTiling.ts` (68 lines, ResizeObserver+rAF, `rowUnit = min(heights)`, `spans = clamp(round(h/rowUnit),1,8)`). `columns` = flex, `auto` = `repeat(auto-fit, minmax(var(--min-column-width,300px),1fr))` dense, `collage` = same + `grid-auto-rows: var(--tile-row)` stretch + JS spans. Skeleton via `estimateRowSpan`. Gaps: no per-widget `preferredSize`, no cost function — auto-fit greedily fills, so wide (1920px) bento hero layouts limited to 3 cols, clock/weather stretch to ~500px before 360px cap, CLS until rAF.

Proposed: `shared/widgets/preferredSizes.ts` registry `PREFERRED_SIZES: Record<WidgetType, {preferredWidth: number|null, preferredHeight: number|null, resizable: boolean}>`:

| widget | w | h | note |
|---|---|---|---|
| clock | 300 | 200 | +60 per extra timezone |
| weather | 300 | 280 | 7-day strip |
| calendar | 340 | 320 | month grid min 320 |
| bookmarks | 300 | 240 | icon grid |
| search | 300 | 90 | single input |
| todo | 320 | 220 | 5 items base |
| rss/hn/reddit/lobsters | null | null | fluid, `resizable: true` |
| releases | 360 | 260 | repo cards |
| videos | 380 | 220 | thumbnail cards |
| twitch* | 380 | 260 | (to be removed, size kept for replacement) |
| markets | 340 | 220 | sparkline table |
| monitor | 340 | 200 | status grid |
| repository/custom-api | 360/340 | 200 | single card |
| iframe | 500 | 400 | `span:2` |
| html | null | 200 | fluid w |
| group | 340 | 320 | sum children |
| split-column | null | 320 | inner masonry |

Algorithm (squared deviation, width only per your ask):
1. `preferredSizes` must cover every `WidgetType` (lint fails if missing).
2. For candidate `n ∈ [1..maxCols]` with span minima (`n_eff = n - Σ(max(0,span-1))`), `actualWidth(n) = (W - (n-1)*gap)/n`.
3. `score(n) = Σ_{prefW!=null} (actualWidth(n)*effectiveSpan - prefW)²`, `effectiveSpan = span>1 ? span :1` (add `(span-1)*gap` when span). Fluid `null` tiles excluded; if all null → `n = clamp(floor(W/minColumnWidth),1,maxCols)`.
4. `n* = argmin score(n)`, tie → larger `n` (denser); also clamp `n* ≤ floor(W/minColumnWidth)` and `span ≤ n*`.
5. Apply `repeat(n*,1fr)` or `--min-column-width = actualWidth(n*)` so CSS keeps auto-fit fallback when JS off. Height: `data-row-span = resizable||prefH==null ? ceil(measuredH/rowUnit) : ceil(prefH/rowUnit)`, `rowUnit = --tile-row = min(measuredHeights) || 80px`.
6. `dense` packs holes; ResizeObserver reruns on `W` change.

Sources: bin-packing squared-error balancing, MDN masonry, Chrome grid-lanes flag, WebKit grid-lanes TP, Treemap docs. Future swap to native `display:grid-lanes` is CSS-class change.

## 3. Detailed Design per Sub-Project

### 3.1 Feed Show less — not sticky

*Why:* `WidgetChrome` renders both toggles as `button.more` vs `button.more.moreExpanded`. Current `.moreExpanded { position: sticky; bottom: -1px }` keeps Show less visible forever, covering last row hover `row::before { inset: -4px }` rounded highlight. You want both to scroll.

*Change (1 file):*
- `src/client/components/widget-chrome.module.css` — delete `position: sticky; bottom: -1px;` from `.moreExpanded`, keep `background: transparent` (prevents opaque overlap) and `padding-bottom` fixes (lines 89-98). `WidgetChrome.tsx` unchanged.

*Test:* `WidgetChrome.test.tsx` — “Show less scrolls off, Show more scrolls off” — assert `getComputedStyle(moreExpanded).position !== 'sticky'`.

### 3.2 Minecraft videos — cap 3

*Change (2 YML):*
- `config.example.yml` Social → `Minecraft — Unstable Universe & friends` `limit: 9 → 3` (keep `style: grid-cards`, same 4 channels, so 3 newest across channels via existing feed merge `limit 3`).
- `config.yml` same edit (gitignored but synced for local demo).

No server/client code change — `videos.ts` already honors `limit`.

### 3.3 Remove twitch

*Files:*
- Delete `src/server/widgets/twitch.ts` + remove `registerWidget('twitch-channels'/'twitch-top-games')` path, `src/shared/widgets/keyed.ts` schema entries, `src/client/widgets/twitch/*`, tests `twitch.test.ts`, `videos.handle.test.ts` twitch references if any.
- `config.example.yml` Social → remove `twitch-channels` block (6 lines), `config.yml` same.
- Keep payload types pruned; `registry` no longer lists twitch.

*Replacement slot:* Social right column currently `twitch-channels + bookmarks + todo` — after removal, that column will hold `bookmarks + todo` only until a new widget from §6 (e.g. DNS Stats or Server Stats) is implemented in a follow-up plan.

### 3.4 Search default new-tab

*Current:* `searchSchema` has `'new-tab': z.boolean().optional()` → client `cfg['new-tab'] === true ? !e.ctrlKey : e.ctrlKey` so default is same-tab. You want default new-tab but configurable.

*Change:*
- `src/shared/widgets/search.ts` — `'new-tab': z.boolean().default(true)` (or `.optional().default(true)` for zod v4 compat, follow repo pattern `z.boolean().default(() => true)`).
- `src/client/widgets/search/index.tsx` already honors swap; no logic change — just schema default makes `cfg['new-tab'] ?? true` behave as new-tab. Keep `target` (`_blank` default in `resolveSearch`) as override: `target: cfg.target ?? '_blank'` when `newTab`, `_self` otherwise — already in `engine.ts`.
- Update `config.example.yml` comment: `# new-tab: true (default) — open results in new tab; set false for same-tab`.

*Test:* `search.test.tsx` — default (no `new-tab` key) → `window.open(..., '_blank', 'noopener,noreferrer')`; explicit `new-tab: false` → `_self`.

### 3.5 Homelab real stats — graceful without lab

*Goal:* verify “homelab thingy works” — Lab page should show CPU/RAM/disk/GPU temps even if you have no lab; when no data, show placeholder, not crash. `systeminformation` covers Linux/macOS/Win without native addons.

*Design:*
- New dep `systeminformation@^5` (single dep, no native build, supports `cpu`, `mem`, `fsSize`, `cpuTemperature`, `graphics`, `currentLoad`).
- New widget `system-stats` (or reuse `server-stats` name from glance parity but pick `system-stats` to avoid confusion with glance's `server-stats` legacy):
  - Schema `src/shared/widgets/system-stats.ts`: `type: 'system-stats'`, `fields?: ('cpu'|'mem'|'fs'|'temp'|'gpu')[]`, `disks?: string[]`, `cache?: string` (default `5s` live). All optional so default shows all.
  - Server `src/server/widgets/system-stats.ts`: `registerWidget('system-stats', async (ctx, config) => { try { const [cpu, mem, fs, temp, gpu, load] = await Promise.all([si.cpu(), si.mem(), si.fsSize(), si.cpuTemperature().catch(()=>({main:null})), si.graphics().catch(()=>({controllers:[]})), si.currentLoad().catch(()=>({currentLoad: null})) ]); return { cpu: { cores: cpu.cores, speed: cpu.speed, load: load.currentLoad }, mem: { total: mem.total, used: mem.active, free: mem.available }, fs: fs.map(d=>({fs: d.fs, size: d.size, used: d.used, use: d.use, mount: d.mount})), temp: temp.main, gpu: gpu.controllers.map(c=>({model:c.model, temp: c.temperatureGpu})), } } catch { return { cpu:null, mem:null, fs:[], temp:null, gpu:[] } } })` — always returns shape, never throws; cache `TtlCache` + `Singleflight` via `ctx.cache` with `parseCacheDuration(cache ?? '5s')` and `getStale` fallback.
  - Client `src/client/widgets/system-stats/index.tsx` — flat cards: rows `CPU ${cores}@${speed}GHz ${load}%`, `MEM ${used/total} ${(used/total*100).toFixed(0)}%`, `DISK ${mount} ${use}%`, `TEMP ${temp}°C`, `GPU ${model}` — when null show `No data — not running on homelab host` placeholder (checks `data.cpu === null`). Uses same `WidgetChrome` + `Feed` row style as monitor.

*Alternatives considered:* `node-os-utils` (cpu only), `os` built-in (no temp/GPU), client `navigator` (no disks). `systeminformation` wins as single dep with graceful `catch → null`.

*Testing:* `src/server/widgets/system-stats.test.ts` — mock `systeminformation` via `vi.mock`, test null fallback, field filter, cache 5s.

### 3.6 Component Ideas (research output)

Already completed — 12 proposals listed in §2.1. Design decision: **do not implement them now**; keep as `docs/superpowers/specs/component-ideas-appendix.md` appendix and pick 1 replacement for twitch slot in next plan (recommended DNS Stats or Server Stats, lowest effort, glance parity). This spec just records the ideas so writing-plans can reference them.

### 3.7 Collage Compositor — preferred sizes + squared error

See §2.2 table + algorithm. Implementation sketch for plan:

- `src/shared/widgets/preferredSizes.ts` — `export const PREFERRED_SIZES: Record<WidgetType, Pref>` + `export type Pref = { preferredWidth: number|null, preferredHeight: number|null, resizable: boolean }` + `assertAllWidgetsCovered()` called in `src/shared/widgets/index.test.ts` or at import time (throw if `Object.keys(PREFERRED_SIZES).length !== WidgetTypes.length`).

- `src/client/pages/tiling.ts` — add `chooseColumnCount(containerWidth: number, gap: number, minColumnWidth: number, maxCols: number, tiles: {prefW:number|null, span:number}[])` pure helper implementing §2.2 steps 2-4. Unit-tested.

- `src/client/pages/PageView.tsx` — when `tiling === 'collage'|'auto'`, read container width via `ResizeObserver` already in `useCollageTiling` (or new `useColumnCount` hook), compute `n*` via helper, set `style={{ '--min-column-width': `${actualWidth(n*)}px` }}` and/or `gridTemplateColumns: repeat(n*,1fr)` on `.columns`. Keep `getTilingProps` seam.

- `src/client/pages/useCollageTiling.ts` — height path uses `prefH` when `!resizable && prefH != null` → `spans = ceil(prefH/rowUnit)` without measure; else measure as before.

- Config: `PageSchema` already `max 3 columns` — consider raising to 4-6 for bento on 1920px, but keep default 3 to avoid breaking existing `span` assumptions; add comment that `n*` respects `maxCols`.

## 4. Interfaces & Data Flow

- `PREFERRED_SIZES` is a pure map, no runtime deps. `chooseColumnCount` is pure `(W,gap,minW,maxCols,prefs,spans)→n` — testable without DOM.
- `system-stats` reuses existing `TtlCache`/`Singleflight`/`parseCacheDuration` pattern like `hacker-news`/`videos`; payload shape is `SystemStatsData` in `src/shared/widgets/payloads.ts`.
- `search` default flows: `config.yml` omitted `new-tab` → `searchSchema` defaults `true` → `cfg['new-tab'] === true` → `resolveSearch` → `window.open(url, target ?? '_blank')`.

## 5. Error Handling

- `systeminformation` calls wrapped in `.catch(() => null)` per metric — partial data OK (e.g. temp null on M5 without sensor). Widget never throws; shows placeholder rows for nulls.
- `chooseColumnCount` handles all-null (fluid) case → fallback to floor(W/minW).
- Twitch removal: `registry` no longer has `twitch-*`; `PagePayload` build skips absent types — no 500.

## 6. Testing Strategy

- `WidgetChrome.test.tsx` — assert no sticky on `.moreExpanded`.
- `videos` — no test (config only), but `config.test.ts` validates `limit: 3` accepted.
- `search.test.tsx` — default new-tab `_blank`, explicit false → `_self`.
- `system-stats.test.ts` — mocked `systeminformation`, TTL 5s, null fallback, field filter.
- `tiling.test.ts` + `useCollageTiling.test.ts` — `chooseColumnCount` squared error cases: `W=1920,gap=23,min=300` with mix of 300/380/prefs → n*=4; fluid-only → n=6; span-2 hero → effective width; height ceil tests.

## 7. Rollout & Commits

Atomic commits per sub-project, 7 planned:
1. `fix: Show less not sticky`
2. `chore: cap Minecraft videos limit 3`
3. `chore: remove twitch widgets`
4. `feat: search new-tab defaults true`
5. `feat: system-stats widget (systeminformation)` 
6. `docs: component ideas appendix` (already from scout)
7. `feat: collage preferred sizes + squared-error column chooser`

Doctor must stay 100/0, `tsc --noEmit` clean, `bun run test` 414→~420 after new widget.

## Appendix — Component Ideas (verbatim from scout)

See `component-ideas.md` (ephemeral) — 5 categories × 12 ideas with stealFrom: Bento/Tremor/Nivo. Priority DNS Stats > Markets+ > Server Stats > Docker > CI > ChangeDetection.

---
**Next:** invoke `skill://writing-plans` to turn §§3.1-3.7 into checklist plan `docs/superpowers/plans/YYYY-MM-DD-dashboard-polish.md`.
