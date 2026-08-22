# Social 12-col + Retry + Per-Widget Defaults — Design Spec

**Date:** 2026-08-22  
**Status:** Draft — awaiting user review before plan  
**Branch:** `main` — base `708f8c0` (bento health card)  
**Spec for:** `skill://writing-plans` next

## 1. Overview & Goals

Close the 5 gaps flagged on `localhost:3000` screenshots (Social 2×`full` leaves phantom track, todo stuck, handles as UUIDs, 403s on reddit/releases) plus the unification you asked for: 12-col grid everywhere, sensible defaults with explicit `span` override, and per-widget defaults co-located at file top for easy extension.

In scope (6 slices, 1 spec → 1 plan):
1. 12-col grid unification for `columns` pages (Home/Dev/Social/Lab) — `span:1-12` explicit, `small/full` alias inferred
2. Social layout fix — `span:4` side (Tech creators vertical-list + reddit + bookmarks) | `span:8` main (Minecraft grid-cards + todo lined with MC)
3. Handle-only channels — drop `UC…` IDs, Minecraft 7 handles `limit:9`, Tech 3 handles `limit:6`
4. Bottom padding unified — single `.page` gap, `columnWidgets` not stretched
5. Server retry — `fetchWithRetry` 3 tries for 403/429/5xx/network with backoff, respects `Retry-After`
6. Per-widget defaults at top (A) — each widget folder owns `DEFAULTS` + `Schema` header

Out of scope: native `grid-lanes`, new widget types, yaml `defaults:` top-level map.

## 2. Research Summary

Glance has no auto-tiler. `glance/internal/glance/static/css/site.css: .page-columns {display:flex; gap:var(--widget-gap)}` + `.page-column-small{width:300px}` + `.page-column-full{width:100%}` — flex only. `config.go: ≤3 columns, 1-2 fulls required`. Mobile `≤1190px` (`mobile.css`) hides all columns and shows one via radio `body:has(input[value="0"]:checked) .page-columns > :nth-child(1){display:block}` — column switcher, not recomposer. Inside widgets, `utils.css: .dynamic-columns` grids by `var(--columns-per-row)` and `cards-grid` uses `@container` for `cards-per-row`, but pages don't auto.

Our `tiling: collage / min-column-width / chooseColumnCount(W,gap,340,12)` is custom and caused Social phantom track (`W≈1450 → N*=3` but 2 tiles). Fix is explicit 12-col `repeat(12,1fr)` with `span` mapping, keeping glance's `small=300px≈3/12 @1600, full` inference so old configs still parse.

## 3. Detailed Design

### 3.1 12-col grid (columns pages)

Schema: `src/shared/config.ts` `ColumnSchema` gains `span?: 1-12 int` (optional, `z.number().int().min(1).max(12)`). `size` stays `small|full` optional for alias. Validation: if `span` absent, infer: single `full`→12, `full+full`→6/6, `full+small`→9/3, `full+small+small`→6/3/3, `small+full+small`→3/6/3, etc. Helper `resolveSpan(columns): number[]` pure.

Layout: `src/client/pages/page.module.css` `.columns` switches from `display:flex` to `display:grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: var(--widget-gap); align-content:start`. Each column gets `grid-column: span var(--col-span)` via inline `--col-span`. `smallColumn/fullColumn` become aliases that set `--col-span` via data attribute or class (`data-size="small" → --col-span:3` fallback). Mobile `@media (max-width:768px)` forces all columns `grid-column:1 / -1` stacked.

Tiling: `tiling: columns` uses this grid. `tiling: collage/auto` keeps existing `auto-fit` for bento `widgets:` pages only; `columns` pages ignore `tiling` for grid choice. `src/client/pages/PageView.tsx` `columnsRef` path removed for `columns` (no `chooseColumnCount` for them), only bento uses it.

### 3.2 Social layout

Target `Social: span:4 | span:8 / span:4 | span:8` lined with MC per your A:

```
Row1: [videos Tech creators vertical-list 4] [videos Minecraft grid-cards 8]
Row2: [reddit selfhosted 4 + bookmarks Social 4 stacked] [todo 8]  — bookmarks in 4 under reddit, todo 8 under minecraft
```

Actual columns: 2 grid items, each spans 4 or 8, each `columnWidgets` stacks 2-3 widgets vertically via `gap`. So `Social columns: [{span:4, widgets:[videos Tech, reddit, bookmarks]}, {span:8, widgets:[videos Minecraft, todo]}]` with `limit:6` tech, `limit:9` minecraft (7 handles → 3×3 grid on 8-wide), `limit:8` reddit.

Config files: `config.yml` + `config.example.yml` both updated. Channels: replace `UCGw…/UCPL…/UCkz…` with handles `["@wemmbu","@ParroX2","@FlameFrags","@SpokeIsHere","@Evourai","@Minotaurmc","@TheNamesSX"]` (7). Tech creators stays `["@Fireship","@ByCloud","@BetterStack"]`.

### 3.3 Handle-only

`src/server/widgets/videos.ts` already supports `@handle` via `resolveHandleToChannelId(ctx, handle)` → fetch `https://www.youtube.com/@handle` → regex `externalId|browseId|channelId` → `UC…` → `feeds/videos.xml?channel_id=UC…`. Handles are partitioned by `feedUrlForId` which now only receives resolved IDs. No code change, just config.

Test: `videos.handle.test.ts` adds cases for the 4 new handles resolving to non-empty channelIds (mock fetch of handle HTML).

### 3.4 Bottom padding unified

Root cause: `.columns` flex stretch makes short column (right) stretch to left height, leaving phantom inside `columnWidgets`. Fix: `.columns` as grid doesn't stretch columns (each column `height:auto`), plus `.page { padding-bottom: var(--widget-gap) }` unified (remove `collageTiling {padding-bottom}` duplication). `columnWidgets { align-content:start; height:auto }` keeps widgets packed at top. No new wrapper component.

### 3.5 Retry

New helper `src/server/widgets/http.ts: fetchWithRetry(ctx, url, {retries:3, baseDelay:500, factor:2, jitter:true}, opts)` — wraps `ctx.fetch` + `AbortSignal.timeout`. Retry on `!res.ok` where `status ∈ {403,429,500,502,503,504}` or network throw (`TypeError`/abort). Delay `base * factor^attempt + random(0,100)`, honour `Retry-After` header (seconds or date) if present, cap at 5s. After final failure throw original error for `WidgetChrome` red dot.

Consumers: `reddit.ts` (listing fetch + `getAccessToken` token fetch), `releases.ts` (each `fetchReleases` per repo, `DockerTags` fetch), `videos.ts` (`resolveHandleToChannelId` fetch + `feedUrl` fetch), `repository.ts`/`custom-api.ts`/`rss.ts` (generic). No yaml knob.

Test: `http.test.ts` new — mock `ctx.fetch` failing 2×403 then 200, assert 3 calls, delay mocked via `vi.useFakeTimers`.

### 3.6 Per-widget defaults at top (A)

Each widget owns its defaults in its file header so adding a widget is one file + one aggregation line.

- `src/shared/widgets/<name>.ts` top: `export const <NAME>_DEFAULTS = { limit:…, style:…, … } as const; export const <name>Schema = z.object({ type: z.literal('<name>'), ...sharedWidgetFields, limit: z.number().int().min(0).default(<NAME>_DEFAULTS.limit), … }).loose(); export type …; export const <NAME>_PREF: Pref = { cols:…, rows:…, … }`
- `src/server/widgets/<name>.ts` top: `import { <NAME>_DEFAULTS } from '../../shared/widgets/<name>'; const DEFAULTS = <NAME>_DEFAULTS;` and use `cfg.limit ?? DEFAULTS.limit`.
- `src/client/widgets/<name>/index.tsx` top: same `DEFAULTS` for UI fallbacks.
- Aggregation: `src/shared/widgets/index.ts` re-exports, `src/shared/widgets/preferredSizes.ts` imports `*_PREF` from each widget file (single line per widget) — no central JSON bottleneck.

Adding `todo-more` widget: create `src/shared/widgets/todo-more.ts` with header, `src/server/widgets/todo-more.ts` with header + `registerWidget`, `src/client/widgets/todo-more/index.tsx` with header + `registerWidgetComponent`.

## 4. Interfaces & Data Flow

- `ColumnSchema.span?` threads through `ConfigSchema → ResolvedConfig → PagePayload → PageView` → CSS var `--col-span`. Pure `resolveSpan(columns): number[]` helper tested in `src/shared/config.test.ts`.
- `fetchWithRetry` signature: `(ctx, url, retryOpts, httpOpts) → Promise<Response>`; `fetchJson`/`fetchText` delegate.
- `videos.ts` channel pipeline unchanged: `channels: string[]` (now `@handle` only) → `feedUrlsForChannels` → `resolveHandleToChannelId` (retry-wrapped) → `fetch(feedUrl)` (retry-wrapped) → `parseVideoFeed`.
- Config YAML: Social example is source of truth for handle-only pattern.

## 5. Testing

- `src/shared/config.test.ts` — span inference cases (single full →12, full+full→6/6, Social 4+8, explicit override wins).
- `src/client/pages/PageView.test.tsx` — Social 4/8 renders two columns with `gridColumn: span 4/8`, mobile all `span 12` (window resize mock).
- `src/server/widgets/http.test.ts` — retry 403→200, 429 with Retry-After, network throw, success.
- `src/server/widgets/videos.handle.test.ts` — new handles resolve.
- Existing `page.module.css` snapshot: columns grid not flex.

## 6. Rollout & Commits

Atomic: `feat: 12-col columns grid with span + alias`, `fix: Social 4/8 layout handle-only`, `fix: page bottom padding unified`, `feat: fetchWithRetry for reddit/releases/videos`, `refactor: per-widget defaults at file top (A)`. `tsc --noEmit` 0, `bun run test` ~484→~490, `doctor 100`, `build` ok, both yamls parse.

---
**Next:** invoke `skill://writing-plans` to turn §3 into checklist plan `docs/superpowers/plans/2026-08-22-social-12col.md`.
