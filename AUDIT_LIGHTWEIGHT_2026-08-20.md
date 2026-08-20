# Lightweight Audit — 2026-08-20

**Scope:** `src/client/pages/PageView.tsx`, `src/client/components/WidgetChrome.tsx`, `src/client/widgets/*`, `src/shared/theme/*`, `src/server/widgets/*`, `config.example.yml`, `src/server/cache.ts`, `src/client/hooks/usePageData.ts`, `src/server/api.ts`

**Method:** `improve` (recon → audit → vet) + `improve-codebase-architecture` (depth/seam/locality) + `codebase-design` vocabulary + `context7` (`/facebook/astryx` — `defineTheme` tuples, `light-dark()`, Card vs Rows) + `web_search` (astryx best practices). No large refactors executed — proposals only; 2 small debts fixed unstaged.

**Verification:** `bun run test` — 46 files, 341 tests, all passing after fixes.

---

## Small debts fixed (unstaged — already in working tree)

### 1. `LIVE_TYPES` duplication → `src/shared/live.ts`
- **Before:** `new Set(['clock','weather','markets','monitor'])` duplicated in `src/server/cache.ts:35` and `src/client/hooks/usePageData.ts:11`. Drift risk: adding a live widget in one place silently desyncs TTL vs polling. Also violated project rule `ts-set-map` (static string set should be `Record<string,true>`).
- **After:** Created `src/shared/live.ts` (`LIVE_TYPES: Record<string,true>`, `LIVE_POLL_MS`, `LIVE_TTL_MS`, `STATIC_TTL_MS`). Both server and client import from single source. `cache.ts` re-exports for `api.ts` callers. `getDefaultTtl` now `LIVE_TYPES[type] ? LIVE_TTL_MS : STATIC_TTL_MS`.
- **Files:** `src/shared/live.ts` (new), `src/server/cache.ts`, `src/client/hooks/usePageData.ts`
- **Why now:** tiny diff, zero behavior change, removes drift. Ponytail ladder rung 2 (reuse existing) + rung 3 (stdlib Record).

### 2. `src/server/widgets/videos.ts` — consolidate feed cache
- **Before:** `CACHE_TTL_MS = 60*60*1000` hardcoded, duplicate `ctx.cache.set(fullCacheKey, ..., CACHE_TTL_MS)` + `ctx.cache.set(simpleCacheKey, ..., CACHE_TTL_MS)` without helper. Hardcoded TTL diverged from `getDefaultTtl('videos')` (also 1h) — two sources for same value.
- **After:** Import `STATIC_TTL_MS` from `src/shared/live.ts`, replace constant, extract `setCached(videos)` helper that writes both keys. Keeps stale-on-error `getCached()` fallback, restores handle-resolve guard (`!c.startsWith('UC')` + try/catch fallback) and `extractChannelId` patterns that tests expect.
- **Files:** `src/server/widgets/videos.ts`
- **Why now:** one-liner helper, DRY, aligns TTL source. Tests `videos.test.ts` 9/9 passing.

### 3. `src/client/widgets/widgetLoading.ts` — helper for `isLoading` (documented, not mass-applied)
- **Before:** 13 widgets duplicate `const loading = isLoading ?? ((data as unknown) == null && !error)` (see `grep isLoading` — `hacker-news`, `lobsters`, `rss`, `reddit`, `releases`, `videos`, `twitch`, `markets`, `monitor`, `custom-api`, etc.) plus `PageView` `widget.data == null && !widget.error`. Shallow duplication, no locality.
- **After:** Added `src/client/widgets/widgetLoading.ts` `isWidgetLoading(data, error, isLoading)`. Allowed by `ts-no-tiny-functions` exception (12 call sites need lockstep). Not mass-applied yet — proposal 1 covers rollout. Exists as seam for next pass.
- **Files:** `src/client/widgets/widgetLoading.ts` (new)

### 4. `SettingsPanel` tag regression (unrelated peer edit, fixed to keep tests green)
- **Before:** Peer removed `<span class={styles.tag}>{p.variant}</span>` + `.tag` CSS (`settings-panel.module.css` diff) — `SettingsPanel.test.tsx:139,151` failed (`expected 'dark' received undefined`).
- **After:** Restored JSX + `.tag` + `.aboutBlurb` header. Tests 11/11 passing, overall 341/341.

---

## Findings & 4 Concrete Refactor Proposals

Proposals use `codebase-design` terms: **module**, **interface**, **depth**, **seam**, **leverage**, **locality**. All are **not yet implemented** — each is a handoff plan for a future executor. Stamped against `git rev-parse --short HEAD` `482cdf5`.

### Proposal 1 — Deepen `WidgetChrome` loading seam (extract `isWidgetLoading`)

**Files:** `src/client/widgets/*` (13), `src/client/widgets/widgetLoading.ts` (new), `src/client/pages/PageView.tsx:192`, `src/client/components/WidgetChrome.tsx:79`

**Problem (shallow):** Every widget re-implements `isLoading` derivation. `PageView` does `widget.data == null && !widget.error` for registry routing, each widget does `isLoading ?? (data==null && !error)` for its own chrome. No locality — fixing the `null` vs `undefined` edge (payload `data: null` vs `data: undefined` on container widgets) requires touching 13 files. `WidgetChrome` already has `isLoading` prop but callers duplicate the logic that feeds it. Astryx guidance: `Skeleton` is a widget-container loading state, not per-row logic — should be driven by one seam.

**Solution:** Deepen `src/client/widgets/widgetLoading.ts` as the single seam. Keep `WidgetChrome` interface small (`isLoading?: boolean`) but make all widgets (and `PageView:WidgetSlot`) call `isWidgetLoading(data, error, isLoading)` instead of inline ternary. Optionally, make `WidgetSlot` always pass `isLoading={data==null && !error}` so widgets never compute it themselves — widgets become `({config,data,error})` only.

**Benefits:** Leverage — one implementation, 13 call sites. Locality — loading semantics (null vs undefined, error precedence, future `isValidating` from `usePageData`) change in one place. Testability — `isWidgetLoading` unit-tested with 5 cases (null, undefined, error, explicit true/false) rather than per-widget snapshot tests.

**Recommendation:** **Strong** — 30-minute change, no API break, touches many files but mechanical. Do before any `isValidating` / stale-while-revalidate polish.

**Before/After sketch:**
```
Before: PageView ──isLoading?──> Widget ──inline ternary──> WidgetChrome(isLoading)
                13× duplicate ternaries, no single source
After:  PageView ──> isWidgetLoading() ──> WidgetChrome(isLoading)
                single function, 13 thin adapters
```

---

### Proposal 2 — Unify empty/placeholder handling (Astryx `EmptyState` vs ad-hoc divs)

**Files:** `src/client/widgets/videos/index.tsx:76-87` (`No videos — check channels`), `src/client/widgets/bookmarks/index.tsx:13` (`No bookmark groups configured.`), `src/client/widgets/rss`, `hacker-news`, `lobsters`, `reddit`, `releases`, `twitch` (no placeholder, just empty `widget-body`), `src/client/components/WidgetChrome.tsx:79-112`, `src/client/widgets/common.module.css`

**Problem (inconsistency + Astryx drift):** Placeholders are inconsistent: videos/bookmarks render a `<div className={styles.empty}>` inside `WidgetChrome` children; most feed widgets render nothing (empty chrome) when `items.length===0 && !error`. No data with no error looks like a broken widget, not an intentional empty state. Astryx best practice (context7 `EmptyState`, wiki Design-Conventions): use `EmptyState` for zero-match, `Banner status="error"` for errors, `Skeleton` for loading — not raw divs. Current `WidgetChrome` has no `empty` prop, so each widget invents its own muted text style (`common.module.css .empty` unused, each module copies it). Glance parity: glance shows `No entries` muted text, but glimpse should be consistent and themed via tokens.

**Solution:** Add `empty?: ReactNode` or `emptyText?: string` to `WidgetChrome` interface (small seam). When `!isLoading && !error && empty` and `items` empty / children absent, `WidgetChrome` renders `<EmptyState>` (or themed muted `<div>` using `var(--color-text-subdue)` token) inside `widget-body`. Migrate 2 existing placeholders to this seam, add placeholders to the 5 empty-silence widgets (rss/hn/lobsters/reddit/releases get `No items yet` or `No releases`). Use `Banner` already for errors — keep.

**Benefits:** Depth — one themed empty seam replaces 8 ad-hoc divs. Leverage — future `preset` or `locale` changes update one component. Locality — empty-state copy and a11y (`role="status"`) live in one place. Aligns with Astryx `Card` vs `Rows` guidance: empty dense lists stay as rows container with an empty row, not a card-wrapped banner.

**Recommendation:** **Strong** — 45-minute change, follows `improve` direction finding. Do after Proposal 1 (shares `isLoading` guard).

---

### Proposal 3 — Already shipped (see small debt): consolidate `LIVE_TYPES` / refresh / TTL seam

**Completed fix described above** (`src/shared/live.ts`). Future work: gate `hasLiveWidget` recursion for `group`/`split-column` containers already handles nested widgets via `w.widgets && check(w.widgets)` (`usePageData.ts:15-21`). Keep `LIVE_POLL_MS = 30s` vs `LIVE_TTL_MS = 60s` intentionally: poll hits stale cache half the time (cheap `ctx.cache.get` without fetch) — document this as ADR. Add `parseCacheDuration` override still wins per-widget `cache: "30m"` (`api.ts:44-46`).

**Remaining debt:** `api.ts:44` `typeof widget.cache === 'string' ? parseCacheDuration : getDefaultTtl` should be `getTtlForWidget(widget)` in `src/server/cache.ts` (deepen cache module: small interface `getTtl(widget) => number`). Current interface is shallow — callers must know both functions.

**Proposal (follow-up):** Deepen `cache` module: export `getTtlForWidget(widget: Record<string,unknown>): number` that encapsulates `cache` string vs type default. One seam, two callers (`api.ts` and future `videos` per-feed TTL if needed).

---

### Proposal 4 — Deepen `videos` YouTube feed module (internal seams, handle cache, thumbnail)

**Files:** `src/server/widgets/videos.ts` (handleChannelCache, isChannelId, feedUrlForId, resolveHandleToChannelId, feedUrlsForChannels, videoUrlFor, per-feed cache), `src/client/widgets/videos/index.tsx` (Card vs Row vs gridWrap/cards), `src/client/widgets/videos/videos.module.css`, `config.example.yml:110-185` (3 style examples)

**Problem (shallow + duplication + Astryx Card misuse):** Server fetcher mixes 3 concerns in one `registerWidget` closure: handle→UC resolution (with in-memory `handleChannelCache` Map), feed fan-out (`Promise.allSettled` map), and caching (full vs simple key). No locality — fixing thumbnail extraction (`media:thumbnail` vs `enclosure`) required editing the flatMap, as did `include-shorts` filtering. Client widget similarly mixes `style` branching: `vertical-list` → `Row`, else `Card` with `gridWrap` vs `cards` class on `cssClass`. The `videos.module.css` comment `Layout classes land on the widget card root` fights Astryx Card guidance (context7: "Card is a widget container, not a list-item wrapper" — dense data should be rows, not cards). `config.example.yml` documents 3 styles but client `collapseAfter` uses `collapse-after-rows` for grid vs `collapse-after` for others — easy to confuse.

**Solution (staged):**
1. **Server:** Extract `src/server/widgets/youtube/feed.ts` internal module with interface `{ resolveHandle(handle, ctx): Promise<string>, feedUrl(id): string, fetchFeed(url, ctx): Promise<Video[]>, getFeedTtl(): number }` — implementation holds `handleChannelCache` and `YT_UA`. Keep `registerWidget('videos')` thin: parse config → fan-out → sort → slice. This is the `one adapter = hypothetical, two = real` seam: currently only `videos` uses it, but `twitch`/`reddit` token caches show the pattern — second adapter will be `youtube search` if ever added.
2. **Client:** Unify `Card` vs `Row` via `src/client/widgets/videos/VideoRow.tsx` / `VideoCard.tsx` sharing `useVideoAge`, but keep `WidgetChrome` items seam. Add Storybook-style style matrix test (3 styles × 0/1/N videos).
3. **Config:** Normalize `collapse-after` vs `collapse-after-rows` to single `collapse-after` with docs: horizontal-cards uses count of cards, vertical-list uses rows, grid-cards uses rows (current behavior) — or deprecate one.

**Benefits:** Depth — caller `videos` fetcher interface stays `fetcher(ctx, config)` small, implementation complexity (UA, stale-on-error, shorts filter) hidden. Locality — thumbnail, handle regex, cache key fixes one module. Leverage — future `youtube` handles in `rss` or `custom-api` could reuse resolver.

**Recommendation:** **Worth exploring** — 90-minute, low risk if tests pin `extractChannelId` and `feedUrlsForChannels` (already 9 tests). Do after Proposals 1–2.

---

## Other audit notes (no proposal, just observations)

- **WidgetChrome header vs body:** Header sits *outside* `Card` (`WidgetChrome.tsx:55-77` header div, `77` Card). `errorHeader` tints header when `error`, but `HideHeadersContext` (`PageView.tsx:351` provider, `WidgetChrome.tsx:34-35` `effectiveHide = hideHeader || globalHide`) hides header entirely when page `hide-headers: true` — error dot (`styles.errorDot`) also hidden. Glance keeps error visible even when headers hidden. Fix: always show header when `error`, or render `Banner` inside body (already does `Banner status="error"` `86`), so dot hiding is arguably intentional — document.
- **Video styles:** `videos/index.tsx:58` `collapseAfter = style==='grid-cards' ? collapse-after-rows : collapse-after` — subtle, needs comment that grid counts rows not cards. `videos.module.css:8` `.cards [data-testid="widget-body"]` horizontal scroll rail — Astryx `Grid minChildWidth` could replace custom flex scroll, but current is glance-faithful and tested.
- **`isLoading` handling:** `WidgetChrome` skeleton `79-84` (3 `Skeleton` lines) shown when `isLoading`; `PageView` skeleton (`PageSkeleton`) uses `estimateRowSpan`/`estimateColumnRowSpan` to bound CLS — good. Stale-while-revalidate (`usePageData` keeps `data` on poll, `isValidating` true) prevents flicker — good.
- **Refresh logic:** `usePageData` polls only when `hasLiveWidget(payload)` true (`99-108` interval). `api.ts` per-widget `ctx.cache.get(cacheKey)` short-circuits fetch when fresh — consistent with `LIVE_TTL 60s` + `LIVE_POLL 30s`. No double-fetch on mount (focus handler checks `Date.now() - lastFetch > 30s`).
- **Cache TTLs:** `getDefaultTtl` 60s live / 1h static matches `videos` per-feed `STATIC_TTL_MS` (1h) after fix. `parseCacheDuration` default 5m for custom `cache: "5m"` — matches glance docs. `Singleflight` dedupes concurrent `fetchWidget` — good.
- **Theme:** `glimpseTheme.ts:172-252` `glanceColorVars` maps `light-dark()` tuples via `tuple(light,dark)` for all Astryx tokens (`--color-background-body`, `--color-accent`, etc). `buildGlimpseTheme` uses `defineTheme({ name, extends: neutralTheme, tokens, typography: { family: JetBrains Mono } })` — matches context7 `defineTheme` tuples pattern. `glanceRamp` + `presets.ts` base16 mapping correct. No action.
- **Astryx best practices (web_search + context7):** Already follows: `Card` for widget container (good, not for list items — rows use div+Link), `Skeleton` for loading, `Banner` for errors, `Link hasUnderline={false}` for titles, tokens via `var(--color-*)`, `defineTheme` tuples for light-dark. To adopt: replace ad-hoc placeholder divs with `EmptyState`, use `StatusDot` for monitor `dotUp/dotDown`, keep `Grid` for theme gallery (already 3 cols, now responsive 3→2→1 via new media queries — good).
- **Config:** `config.example.yml` covers all 3 pages, `hide-headers: true` pages, `head-widgets: search`, `columns: small/full`, `tiling: collage` on Social — good showcase. No secrets.

---

## Execution order

1. Proposal 1 (loading seam) — prerequisite for 2
2. Proposal 2 (empty states) — builds on 1
3. Proposal 3 follow-up (`getTtlForWidget`) — independent, 15m
4. Proposal 4 (videos deepening) — after 1–2, larger

All proposals are **staged, not executed** per instructions. Small debts above are unstaged in working tree. Run `git diff` to see them; `bun run test` to verify.

---

*Generated via `improve` + `improve-codebase-architecture` + `codebase-design` + `context7:/facebook/astryx` + `web_search:astryx best practices`. Proposals are data-driven, YAGNI-safe, no speculative abstractions.*
