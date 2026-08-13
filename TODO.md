# Glimpse — Audit & TODO

Thorough audit of the whole codebase (fix / polish / refactor / cleanup). Every item below is a concrete, self-contained task. Check a box when done; add the commit hash or a note.

- **Audited commit:** `d6e2695` (`feat: collage tiling, source headers, settings pane stability, search tightening, config showcase`)
- **Verification baseline:** `bunx tsc --noEmit` ✅ clean · `bun run test` ✅ 42 files / 302 tests pass
- **Not audited:** `glance/` (read-only reference repo, deliberately ignored by `doctor.config.json`); generated theme data `src/shared/theme/schemes.generated.ts` (auto-generated, spot-checked only); live network behavior of the fetchers (tests mock `fetch`).

## How to verify (run before/after every item)

```bash
bunx tsc --noEmit     # typecheck
bun run test          # vitest, 302 tests
bun run build         # tsc + vite build (production bundle)
```

## Priorities

- **P0** — correctness bug, wrong output or data risk. Fix first.
- **P1** — polish/UX/perf that users will notice. Fix after P0.
- **P2** — refactor/architecture/cleanup. No behavior change, lowers long-term risk.
- **P3** — docs/tests/niceties. Do when convenient.

---

## P0 — Bugs

### 1. Weather icon misclassifies snow as rain (dead code path)
**File:** `src/client/widgets/weather/index.tsx` · function `weatherIcon()`

**Problem:** The branch order is broken:
```ts
if (code <= 48) return <CloudFog/>;
if (code <= 67 || code <= 82) return <CloudRain/>;   // catches 51–82
if (code <= 77) return <CloudSnow/>;                  // unreachable: 71–77 already returned
return <CloudLightning/>;
```
WMO snow codes **71, 73, 75, 77** (and snow showers **85, 86**) all render as rain; 85/86 fall through to *lightning*. The `code <= 77 → CloudSnow` branch is dead code. The intended mapping (open-meteo docs) is: `≤67` rain/drizzle, `71–77` snow, `80–82` rain showers, `85–86` snow showers, `95+` thunder.

**Fix:** Rewrite as ordered, non-overlapping ranges:
```ts
if (code === null || code === 0) return <Sun/>;
if (code <= 3)  return <CloudSun/>;
if (code <= 48) return <CloudFog/>;
if (code <= 67) return <CloudRain/>;   // drizzle + rain
if (code <= 77) return <CloudSnow/>;   // 71–77
if (code <= 82) return <CloudRain/>;   // rain showers
if (code <= 86) return <CloudSnow/>;   // snow showers
return <CloudLightning/>;              // 95–99
```

**Verify:** Extend `src/client/widgets/weather/weather.test.tsx` with cases for `71` (Snow), `85` (Snow), `82` (Rain), `95` (Lightning). `bun run test`.

---

### 2. Relative time renders fractional seconds ("42.738193s")
**File:** `src/client/widgets/useRelativeTime.ts` · `formatAge()`

**Problem:** `formatAge` does `if (s < 60) return \`${s}s\`` without flooring `s`. `releases` and `videos` pass a float (`(Date.now() - Date.parse(...)) / 1000`), so items younger than a minute show raw fractional seconds. HN/lobsters/twitch are fine (server floors them), which is why this slipped through.

**Fix:** `const s = Math.floor(Math.max(0, totalSeconds));` (and the existing `Math.floor` calls for m/h/d become redundant but harmless).

**Verify:** Add a unit test for `formatAge` (export it, or test via a rendered `ReleaseRow`/`Video` row with a float age). `bun run test`.

---

### 3. Search widget's kbd hint ignores the configured shortcut
**File:** `src/client/widgets/search/index.tsx`

**Problem:** The input's placeholder correctly uses `shortcut` (`cfg.key ?? 's'`), but the visible `<kbd>S</kbd>` and its `title="Press [S] to focus the search input"` are hard-coded to "S". A user who sets `key: '/'` (or `k`) sees the wrong hint, and the kbd is a lie.

**Fix:** Render `{shortcut.toUpperCase()}` in the `<kbd>` and use the same value in the `title` string.

**Verify:** Extend `src/client/widgets/search/search.test.tsx`: render with `key: 'k'`, assert the kbd shows `K`. `bun run test`.

---

### 4. Column `span` accepts non-integers and silently no-ops
**File:** `src/shared/config.ts` · `ColumnSchema`

**Problem:** `span: z.number().min(1).max(4).optional()` lacks `.int()`. `span: 1.5` passes validation, but `PageView` emits `data-span="1.5"`, which matches no CSS selector (`[data-span='2']`, etc.), so the hint silently does nothing. The tiling design doc explicitly specified `z.number().int().min(1).max(4)`.

**Fix:** Add `.int()` to the span schema. (Note: `.min(1)` is `NaN`-safe; `.int()` on a number is exact.) Also consider adding `.int()` to other integer-shaped fields (`limit`, `collapse-after`, `'min-column-width'`, `height`, `'pull-requests-limit'`, `'issues-limit'`) for consistency — a separate sweep, see P2.

**Verify:** Extend `src/shared/config.test.ts`: assert `span: 1.5` fails and `span: 2` passes. `bun run test`.

---

### 5. Weather geocoding rejects latitude/longitude of 0
**File:** `src/server/widgets/weather.ts`

**Problem:** `if (!place?.latitude || !place.longitude)` uses truthiness, so a location on the equator (`latitude === 0`) or prime meridian (`longitude === 0`) is reported as "location not found". Real edge case (Quito, Accra, the Gulf of Guinea).

**Fix:** Check for `undefined`/`null` explicitly: `if (place?.latitude == null || place.longitude == null)`.

**Verify:** Extend `src/server/widgets/weather.test.ts` with a geocode result `{ latitude: 0, longitude: 0 }` and assert it proceeds to the forecast fetch. `bun run test`.

---

### 6. Widget cache is not invalidated on config reload
**Files:** `src/server/api.ts` (cache key `\`${pageSlug}:${path}\``) · `src/server/index.ts` (single `TtlCache` instance) · `src/server/config.ts` (`reloadConfig`)

**Problem:** The per-widget TTL cache is keyed by *page slug + position* only — not by widget config. When `config.yml` is edited (e.g. change an RSS feed URL, a `custom-api` URL, a subreddit) and auto-reload swaps in the new config, the same key keeps returning the **old cached data** until TTL expires (default 5m). The cache is never cleared on reload.

**Fix (smallest):** in `src/server/index.ts`, expose a `clear()` on `TtlCache` and call it from `initConfig`'s `onChange` (i.e. on every successful/failed reload). Better alternative: include a config fingerprint in the cache key so only affected widgets miss. Recommend the `clear()` approach for v1 — it's one line and matches glance's "reload resets" semantics.

**Verify:** `src/server/config.test.ts`/`api.test.ts`-style test: seed the cache, simulate `reloadConfig`, assert a subsequent `buildPagePayload` refetches. `bun run test`.

---

### 7. `useConfig` caches a rejected config fetch for the session
**File:** `src/client/hooks/useConfig.ts`

**Problem:** `let cached: Promise<...> | null` is set once and never reset. If `/api/config` fails once (transient network blip at boot, or a config error that the user then fixes), the rejected promise is cached forever; every remount of `App` re-rejects without retrying, so the error banner never clears without a hard reload.

**Fix:** On `.catch`, set `cached = null` so the next consumer retries (optionally with a small backoff / focus listener). Keep the happy-path cache (share the resolved config across hooks).

**Verify:** Existing `App`/hook behavior is covered indirectly; add a hook test (mock `fetch` to fail then succeed across two mounts) or verify manually in the browser by toggling a bad config → good config. `bun run test`.

---

## P1 — Polish & UX

### 8. `useRelativeTime` spawns one `setInterval` per rendered item
**File:** `src/client/widgets/useRelativeTime.ts`

**Problem:** Every call creates its own 60s `setInterval`. A 30-item feed = 30 intervals per widget, all firing every minute to re-render. Wasteful and a re-render amplification source on large pages.

**Fix:** Hoist a single shared 60s ticker (module-level `useSyncExternalStore` or a tiny pub/sub `useNow(intervalMs)`), and have `useRelativeTime` subscribe to it instead of owning an interval. Keeps the same visual behavior.

**Verify:** `bun run test` (existing widget tests still pass). Confirm with React DevTools that only one interval/one re-render source exists per page.

---

### 9. Unknown route shows the wrong skeleton then an error banner
**Files:** `src/App.tsx` · `src/client/pages/PageView.tsx`

**Problem:** Navigating to `/nonsense` renders `PageSkeleton` using `activePage` (which fell back to `pages[0]`), then `/api/page/nonsense` 404s and the page shows a raw "page not found" error banner. No redirect, and a flash of the wrong page's structure.

**Fix:** In `App.tsx`, if `pathname.slice(1)` matches no known slug (and isn't `/`), `<Navigate to="/" replace />`. This also makes `RoutePage` only ever receive valid slugs.

**Verify:** Extend `PageView`/App-level test (or a small router test) to assert unknown slug redirects home. `bun run test`.

---

### 10. Static assets served without cache headers
**File:** `src/server/index.ts` · `serveDist()`

**Problem:** `serveDist` returns files with only a content-type, no `Cache-Control`. Hashed Vite assets (`assets/*.js`, `*.woff2`, `*.svg`) could be `public, max-age=31536000, immutable`, and `index.html` should be `no-cache` (revalidate). Without this, browsers fall back to heuristic caching and re-request more than necessary.

**Fix:** Add `Cache-Control` in `serveDist`: immutable for `/assets/` (hashed), `no-cache` for `index.html`/`manifest.webmanifest`, short cache for fonts. Mirror the header style already used on the API routes.

**Verify:** `bun run build && bun run start`, then `curl -sI localhost:3000/assets/<file>.js` shows the immutable header. (Read-only check; no test needed.)

---

### 11. Only JetBrains Mono weight 400 is bundled, but 600 is used
**Files:** `src/index.css` (`@font-face`, weight 400 only) · `src/client/pages/page.module.css` (`font-weight: 600` on `.mobileHeader`/`.mobileToggle`)

**Problem:** Headers/toggles declare `font-weight: 600` against a single 400-weight face, so the browser **synthesizes** bold (faux-bold) — slightly off rendering, not a real font.

**Fix:** Either ship the 600 weight (`JetBrainsMono-SemiBold.woff2`, matching `@font-face`) or drop to `font-weight: 500`/normal. Shipping the real weight is the cleaner fix.

**Verify:** Visual pass; check the network tab loads the 600 face and no faux-bold artifacts.

---

## P2 — Refactor & architecture

### 12. Client imports data-shape types from `server/widgets/*` (layering inversion)
**Files:** 14 sites — every feed widget component + 2 client tests:
`src/client/widgets/{rss,reddit,hacker-news,lobsters,markets,weather,monitor,videos,custom-api,releases,repository,twitch}/index.tsx` plus `rss/rss.test.tsx`, `weather/weather.test.tsx`.

**Problem:** `import type { RssItem } from '../../../server/widgets/rss'` (and siblings) makes the **client depend on server implementation modules**. It works only because `verbatimModuleSyntax` erases type-only imports — but it contradicts the README's own contract ("`src/shared/` holds the … contract, imported by both the client and the server") and is fragile: any future server change (a runtime-only import, a class, a dependency in the type module) can break the client build or accidentally pull server code into the bundle.

**Fix:** Move the per-widget **data payload interfaces** (`RssItem`, `RedditPost`, `HnPost`, `LobsterPost`, `Market`, `WeatherData`, `MonitorSite`, `Video`, `CustomApiItem`, `Release`, `RepoPull`, `RepositoryData`, `TwitchChannel`, `TwitchGame`) into `src/shared/` — e.g. one `src/shared/widgets/payloads.ts`, or alongside each schema. Server fetchers and client components both import from shared. This is a mechanical move + import-path update; behavior unchanged.

**Verify:** `bunx tsc --noEmit` + `bun run test` (all 302). Grep `server/` imports in `src/client/` to confirm zero remain.

---

### 13. Duplicate `manualChunks` comment block in vite config
**File:** `vite.config.ts`

**Problem:** The `manualChunks(id)` function has the same 3-line comment ("Stable vendor chunks…") written **twice**, stacked. Dead text.

**Fix:** Delete the duplicate comment block.

**Verify:** `bun run build` still chunks `react`/`astryx`/`icons` correctly.

---

### 14. Enforce `.int()` on all integer-shaped config fields (sweep)
**File:** `src/shared/widgets/*` + `src/shared/config.ts`

**Problem:** `limit`, `collapse-after`, `'collapse-after-rows'`, `'min-column-width'`, `height`, `'pull-requests-limit'`, `'issues-limit'`, `'thumbnail-height'`, `'card-height'`, `'first-day-of-week'`-adjacent numerics are `z.number()` without `.int()` or `.positive()` where relevant. Fractional/negative values pass validation then mis-render or no-op (same class as bug #4).

**Fix:** One pass adding `.int()` / `.positive()` / `.min()` to numerics that are semantically integers/positive. This is a superset fix of #4 — do #4 first, then this sweep.

**Verify:** Extend `src/shared/config.test.ts` with negative/fractional cases. `bun run test`.

---

### 15. Server fetchers re-validate config with zod on every fetch
**Files:** every `src/server/widgets/*.ts` (e.g. `rssSchema.parse(config)`)

**Problem/note:** Config is already zod-validated at load; each fetcher re-parses it per request. This is harmless defense-in-depth (and catches `unknown`-shaped config), so **not a bug** — but it's worth a deliberate decision: keep it (recommended) or drop it and trust the load-time contract. If kept, consider a comment noting it's intentional so future auditors don't "simplify" it away.

**Action:** Add a one-line comment in `src/server/widgets/registry.ts` documenting the intent; no behavior change.

---

## P3 — Tests & docs

### 16. Close the test-coverage gaps the bugs above reveal
**Files:** `src/client/widgets/weather/weather.test.tsx`, `search/search.test.tsx`, `src/shared/config.test.ts`, `src/server/widgets/weather.test.ts`, and a new `useRelativeTime` test.

**Problem:** The four P0 bugs (#1–#5) all live in code with passing tests — the tests don't exercise edge branches (snow codes, fractional ages, non-default shortcut, non-integer span, zero coordinates).

**Fix:** Add the tests described in each P0 item, then a quick pass to add one edge-case test per widget's least-covered branch (e.g. `markets` empty chart, `custom-api` frameless error path, `monitor` `show-failing-only`).

**Verify:** `bun run test` count grows; nothing regresses.

---

### 17. Track the `docs/tiling-design.md` follow-ups
**File:** `docs/tiling-design.md`

**Problem:** The doc lists concrete follow-ups that are currently unplanned and invisible to the project: (a) align the mobile breakpoint with glance's 1190px + single-column tab nav, (b) widget-internal container queries (`@container widget` bands for bookmarks/markets/monitor/docker-style interiors), (c) `display: grid-lanes` swap when engines ship it, (d) optional `tile-row-height` override if real configs hit the "shortest tile skews the row unit" outlier.

**Fix:** Add these as tracked items here (or GitHub issues) so they aren't lost; mark them "future / needs a real config to justify".

---

### 18. README drift check
**File:** `README.md`

**Problem/note:** README is mostly accurate and detailed. One spot-check: it says "22 widget types" (correct), and `config.example.yml`/`config.yml` are byte-identical (fine — `config.yml` is the live showcase). No action beyond re-verifying counts if widgets are added/removed.

---

## Security notes (documented, deliberate — do NOT "fix" without discussion)

- **`custom-api` is server-side SSRF by design.** It fetches any configured URL (https only unless `allow-insecure`). It's the widget's purpose, mirroring glance. Treat the config file as trusted input (it already is: it runs server-side with env access). If multi-tenant configs ever arrive, this becomes P0 — worth a comment in the schema.
- **`iframe` has no `sandbox`** and **`html` uses `dangerouslySetInnerHTML`**. Both are deliberate: `react-doctor/iframe-missing-sandbox` and `react-doctor/dangerous-html-sink` are explicitly turned off in `doctor.config.json`, and the README describes `html` as raw HTML from a trusted local config. Keep as-is; don't silently "harden" without a config-surface decision.
- **`reddit` `app-auth` secrets and Twitch/GitHub tokens** are kept server-side (env / config) and never reach the client — confirmed correct per the architecture. Don't regress this when refactoring #12.

## Considered & rejected (don't re-audit these next run)

- **Re-validating config in fetchers** — intentional defense-in-depth (#15).
- **768px mobile breakpoint vs glance's 1190px** — a documented deviation; move to #17 as a feature, not a bug.
- **`span` cap of 3 columns vs auto-mode wanting more** — `docs/tiling-design.md` §4 explicitly defers; revisit only with a real config request.
- **`slim` page + fixed 300px small column cramping** — the `tiling: auto`/`collage` modes are the designed escape hatch.

## Suggested execution order

1. **P0 first, in order:** #1 → #2 → #3 → #4 → #5 → #6 → #7 (each is independent and small; #4 is a subset of #14).
2. **P1:** #8 → #9 → #10 → #11.
3. **P2:** #12 (biggest single refactor — do it in isolation on its own commit) → #13 → #14 → #15.
4. **P3:** #16 (as each bug is fixed) → #17 → #18.

Dependencies: #14 depends on #4. #16 depends on #1–#5. #12 touches 14 files — land it separately from behavior changes so its diff is a pure move.
