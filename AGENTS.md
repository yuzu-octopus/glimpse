# Repository Guidelines

## Project Overview
Glimpse is a glance-inspired self-hosted dashboard — **Bun + Vite + React 19 + Astryx** SPA with server-side fetching. 22 widget types (feeds, keyed feeds, containers) rendered into a **12-col bento grid** (`pages → columns → widgets` from YAML). 48 base16 presets (+ glance HSL overrides), PWA shell (`vite-plugin-pwa`, network-first API). Config lives in `config.yml` (`$include`, `${ENV}` interpolation, `GLIMPSE_CONFIG` override); secrets stay server-side.

## Architecture & Data Flow
```
config.yml → shared/config.ts (Zod discriminated union) → server/config.ts (watch, $include, ${ENV})
  → server/api.ts buildPagePayload | streamPagePayload → TtlCache + Singleflight (stale-on-error)
  → GET /api/page/:slug?stream (NDJSON: $skeleton line first, then per-widget chunks in settle order)
  → client/hooks/usePageData.ts (SWR pageCache + shape-overlay reconcile, urgent per-chunk renders)
  → client/pages/PageView.tsx (--col-span grid / data-span bento, memoized WidgetSlot)
  → WidgetChrome → lazy registry ensureWidgetLoaded(type) → Suspense → client/widgets/<type>/index.tsx
```
- **Shared contract:** `src/shared/` Zod schemas + wire types (`api.ts`) + theme tokens are imported by both sides; shared is a leaf (no runtime imports of server/client).
- **Widget path:** `shared/widgets/<group>.ts` (schema + DEFAULTS + PREF), `server/widgets/<type>.ts` (`registerWidget`), `client/widgets/<type>/index.tsx` (`registerWidgetComponent`). Typed registries join them.
- **Caching:** per-widget TTL cache keyed `slug:path` (`h:i`, `w:i`, `c:col:i`); fresh hit short-circuits; on fetcher failure `getStale` serves the 24h-retained copy (stale-on-error). `Singleflight.run(key, fn)` dedupes concurrent fetches.
- **Streaming:** first NDJSON line is `{path:'$skeleton', payload:skeletonPagePayload(page)}` (full layout, all `data:null`) so cold loads paint immediately; subsequent chunks use path forms `headWidgets[i]`, `widgets[i]`, `columns[ci].widgets[wi]` — note these differ from cache-key paths. Stream `cancel()` aborts upstream fetches (`AbortSignal.any`).
- **Client SWR:** module-level `pageCache` (30s stale, 5m GC) + inflight dedupe; caller aborts never kill the shared fetch (internal AbortController); `reload(force)` bypasses cache+inflight for skeleton refill; `reconcileWithCached` adopts skeleton layout and overlays cached payloads by index so config-shape changes appear instantly; errors surface only when there is no last-good data.
- **Polling:** `liveKey` single tree walk → homelab types poll 1s, other LIVE_TYPES 30s, static none. TTL sources live only in `shared/live.ts`.
- **Theme:** presets/base16 → `ThemeSourcePair` → `glanceRamp` → `[light,dark]` tuples → Astryx `defineTheme` + `documentElement` mirror + paint snapshot `localStorage['glimpse.paint.v1']` (anti-FOUC boot script reads it pre-React).

## Key Directories
- `src/shared/` — Zod config (`config.ts`, `api.ts`, `layout` constants), `widgets/` schemas + `payloads.ts`/`preferredSizes.ts`, `theme/` (`base16.ts`, `schemes.generated.ts`, `glanceHsl.ts`, `glimpseTheme.ts`, `presets.ts`)
- `src/server/` — `index.ts` (Bun.serve :3000, SPA + `/api/*`, ETag), `config.ts` (YAML load/watch), `cache.ts` (TtlCache/Singleflight), `api.ts` (payload build/stream/skeleton), `widgets/` fetchers + `registry.ts`/`runtime.ts`/`http.ts`/`xml.ts`/`engagement.ts`
- `src/client/` — `main.tsx`→`App.tsx` (BrowserRouter), `pages/PageView.tsx` + `page.module.css` + `tiling.ts`/`useCollageTiling.ts`, `hooks/` (useConfig, usePageData), `components/` (TopNav, WidgetChrome, SettingsPanel), `widgets/` (lazy registry + renderers), `theme/GlimpseThemeProvider.tsx`
- `src/test/setup.ts` — jsdom polyfills (localStorage, HTMLDialogElement, Bun global)
- `public/` — favicon/icon SVG, fonts (woff2 precached); `dist/` — hashed Vite build (gitignored); `glance/` — reference Go app (gitignored, never linted); `docs/superpowers/{specs,plans}` — design docs

## Development Commands
```bash
bun install
cp config.example.yml config.yml
bun run dev:server   # bun --watch src/server/index.ts (:3000)
bun run dev          # vite :5173, proxies /api -> :3000 (changeOrigin)
bun run build        # tsc --noEmit && vite build -> dist/ (PWA precache ~1MB)
bun run start        # bun serves dist/ + API (:3000; GLIMPSE_PORT, GLIMPSE_CONFIG or argv[1])
bun run test         # vitest run (jsdom, globals)
bun run test:watch   # vitest watch
npx react-doctor@latest  # full scan gate; glance/** ignored via doctor.config.json
```
Env: `GLIMPSE_CONFIG` (CLI arg wins > env > ./config.yml), `GLIMPSE_PORT=3000`, `GITHUB_TOKEN`, `${VAR}` interpolation in YAML. No `.env` loader (`.env*` gitignored).

## Code Conventions & Common Patterns
- **Strict TS:** `strict`, `verbatimModuleSyntax`, `ES2024/bundler`, `noEmit`, noUnusedLocals/Parameters. No `ReturnType` aliases, no inline casts (except CSSProperties custom-var objects), unconditional hooks.
- **Zod v4:** `.loose()`, `z.record()` 2 args, `.default(()=>...)`. Validate at trust boundaries; fetchers re-validate their config slice per fetch (intentional defense-in-depth — keep it). Schema defaults supply `limit`; fetchers must not re-default.
- **Naming:** kebab-case widget types, PascalCase components, `*.module.css`. `PREFERRED_SIZES[type] = {span, resizable, cols, rows}` drives bento sizing.
- **Registries:** server `registerWidget(type, fn)` / client `registerWidgetComponent(type, comp)`; client barrel is lazy (`widgetLoaders` dynamic imports, `ensureWidgetLoaded`, idle `scheduleWidgetPreload()` from `main.tsx`). iframe/html share one chunk.
- **Async:** `fetchWithRetry` (backoff+jitter, retryable statuses) for all remote calls; `Promise.allSettled` fan-out for feed lists; `sanitizeUrl()` in EVERY thrown fetch error so query-string secrets never reach `payload.error`.
- **Memo invariants (load-bearing):** streaming replaces whole widget object refs (`applyChunk` never mutates rendered payloads) — this is why `memo` on WidgetSlot/MobileColumn/BentoItem is safe; `spanStyle(span)` returns cached style objects so memoized columns never see fresh refs. Don't break either.
- **Grid:** column footprint = `--col-span` CSS var; tile footprint hint = `data-span` attribute (emitted when span>1); mobile media queries remap with `!important` (12→8, 9→5, 8→5, 6→4, 4→3, 3→2).
- **WidgetChrome:** `collapseAfter >= 0` truncates behind Show more; `-1` (any negative) never collapses; `items` renders rows, `children` otherwise.
- **State:** no global store; `useConfig` (cached Promise, failures retried) + `usePageData(slug)`; `localStorage` only for theme (`glimpse.theme.v1`, paint snapshot `glimpse.paint.v1`) and todo.
- **Astryx warning:** ONLY valid API reference is `node_modules/@astryxdesign/core/dist/**/*.d.ts` (`defineTheme`, `<Theme theme mode>`, Card/Banner/Text/TabList/Skeleton/SelectableCard/Dialog/Link). The `skill://astryx` documents an INVENTED API (ThemeProvider/createTheme/swizzle) — never "fix" code toward it.
- **Deliberate ignores:** react-doctor off-rules (iframe-sandbox, no-multi-comp, no-fetch-in-effect, dangerous-html-sink, set-state-after-await-in-effect, unused-export, low-supply-chain-score) are intentional; don't re-enable or code around them silently.

### Adding a widget (checklist)
1. Schema + DEFAULTS + PREF in `src/shared/widgets/<group>.ts` (feeds.ts / keyed.ts / clock.ts / …); add to `schemaEntries` in `src/shared/widgets/index.ts`.
2. Size pref entry in `src/shared/widgets/preferredSizes.ts` (`assertAllWidgetsCovered` fails tests if missing).
3. Data widgets: fetcher in `src/server/widgets/<name>.ts` (`registerWidget`) + import in `src/server/widgets/index.ts`. Config-only widgets (clock, bookmarks, search, todo, calendar, iframe, html, group, split-column): no fetcher — builder yields null data.
4. Renderer `src/client/widgets/<name>/index.tsx` (`registerWidgetComponent`) + loader entry in `src/client/widgets/index.ts` `widgetLoaders`.
5. Tests mirroring the three files (see Testing).

## Important Files
- Entry: `index.html` (FOUC boot script reads `glimpse.paint.v1`) → `src/main.tsx` (scheduleWidgetPreload) → `src/App.tsx`; server `src/server/index.ts`
- Config contract: `src/shared/config.ts` (WidgetSchema union; PageSchema requires columns OR flat widgets; ≤3 columns; resolveSpan explicit-spans-all-or-none), `config.example.yml` (Home/Dev/Social/Lab)
- Data contract: `src/shared/api.ts` (`PagePayload`, `WidgetPayload` — config carries BOTH kebab+camel aliases for hide-headers), `src/server/api.ts` (build/stream/skeleton + cache-path templates)
- Grid/layout: `src/client/pages/PageView.tsx`, `page.module.css`, `tiling.ts` (COLLAGE_ROW_SPAN_MIN/MAX shared with skeleton estimators), `src/shared/widgets/preferredSizes.ts`
- Engine: `src/client/hooks/usePageData.ts` (SWR/streaming/liveKey), `src/server/cache.ts`, `src/server/widgets/runtime.ts` (stale-on-error), `src/shared/live.ts` (single TTL/poll source)
- Theme: `src/client/theme/GlimpseThemeProvider.tsx`, `src/shared/theme/glimpseTheme.ts` (API warning header), `presets.ts` (48 deduped), `glanceRamp.ts` (cm/tsm accepted-for-compat but intentionally ignored)
- Tooling: `vite.config.ts` (manualChunks checks react-router BEFORE react — order matters; workbox globPatterns woff2+svg; NetworkFirst 3s for /api/config, /api/page/, /api/theme), `tsconfig.json`, `doctor.config.json`

## Runtime/Tooling Preferences
- **Runtime:** Bun ≥1.3 (`Bun.serve`, `Bun.file`, `Bun.YAML`, `Bun.XML`, `bun --watch`). Node never runs the server; plain-node YAML fallback exists only for vitest.
- **Package manager:** `bun` / `bunx` (never npm/npx/node/pip). `bun.lock` is the lockfile; `trustedDependencies` covers @astryxdesign postinstall scripts.
- **Build:** Vite 6 + `@vitejs/plugin-react`, `vite-plugin-pwa` (autoUpdate, `navigateFallbackDenylist [/^\/api\//]`), lazy widget chunks + manualChunks react/astryx/icons/react-router-dom. `/api/config` sends no-store while the SW caches it — intentional offline layering, documented in vite.config.ts.
- **Constraints:** headless shared Chromium available for browser smoke tests; `glance/**` ignored everywhere; README's twitch-* section and omitted-widget list are STALE (twitch widgets don't exist; server-stats/dns-stats/docker-containers DO).

## Testing & QA
- **Stack:** Vitest 4 + jsdom + `@testing-library/react` + `jest-dom`, `globals:true`, `setupFiles: ./src/test/setup.ts` (localStorage polyfill, dialog shims, Bun global).
- **Conventions:** one schema test + one fetcher test + one component test per widget. Fetcher tests inject `WidgetFetchContext` (fixtures + fake fetch, zero network) — canonical template `src/server/widgets/rss.test.ts`; cross-cutting behavior in `widget-behavior.test.ts` (fake timers). Hook tests: `vi.stubGlobal('fetch')`, `vi.resetModules()` + dynamic import, `__clearCacheForTests()` between tests; NDJSON fixtures simulate `$skeleton` + chunk lines. Component tests: stub via `registerWidgetComponent` in beforeEach (delete after) OR `await __preloadWidgetsForTests()` for real lazy modules — registration is async by default now.
- **Gates:** `bunx tsc --noEmit` clean · `bun run test` green (~506 tests) · `npx react-doctor@latest` full scan **100/100** (the `--scope changed` flag is unreliable — always full scan).
- **Run:** `bun run test` (CI-equivalent), `bun run test:watch` locally, `bunx tsc --noEmit` before commit.
