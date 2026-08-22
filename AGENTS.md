# Repository Guidelines

## Project Overview
Glimpse is a glance-inspired self-hosted dashboard — **Bun + Vite + React 19 + Astryx** SPA with server-side fetching. 22 widget types (feeds, config-only, containers) rendered into a **12-col bento grid** (`pages → columns → widgets` from YAML). 58 base16 presets + glance HSL overrides, PWA shell (`vite-plugin-pwa`, network-first API). Config lives in `config.yml` (`$include`, `${ENV}` interpolation, `GLIMPSE_CONFIG` override); secrets stay server-side.

## Architecture & Data Flow
```
config.yml → shared/config.ts (Zod) → server/config.ts (watch, $include, ${ENV})
  → server/api.ts buildPagePayload/streamPagePayload → TtlCache + Singleflight
  → GET /api/page/:slug (NDJSON stream) → client/hooks/usePageData.ts
  → client/pages/PageView.tsx (repeat(12) grid, --col-span, 12→8→1 responsive)
  → WidgetChrome → client/widgets/<type>/index.tsx (registry)
```
- **Shared contract:** `src/shared/` Zod schemas + types + theme tokens are imported by both sides — client and server never drift.
- **Widget path:** `shared/widgets/<type>.ts` (schema, `PREFERRED_SIZES` span), `server/widgets/<type>.ts` (fetcher, `registerWidget`), `client/widgets/<type>/index.tsx` (renderer, `registerWidgetComponent`). Typed registries join them.
- **Grid:** `12×1fr gap: clamp(12px,1.6vw,23px)` desktop; `900–1199 landscape: 12 cols gap 14–20`; `600–899 portrait: 8 cols` with `!important` remap `8→5,6→4,4→3,3→2`; `≤599: 1/-1` stacked. `container-type:inline-size` for widget container queries.
- **Theme:** `shared/theme/` base16 → Astryx tokens → `client/theme/GlimpseThemeProvider` + picker (system/light/dark).

## Key Directories
- `src/shared/` — Zod config (`config.ts`, `api.ts`, `layout.ts`), `widgets/` schemas + `payloads.ts`/`preferredSizes.ts`, `theme/` (`base16.ts`, `schemes.generated.ts`, `glanceHsl.ts`, `glimpseTheme.ts`)
- `src/server/` — `index.ts` (Bun.serve :3000, serves `dist/` + `/api/*`, ETag), `config.ts` (YAML load), `cache.ts` (TtlCache/Singleflight), `api.ts` (cache key `c:colIdx:i`), `widgets/` fetchers + `registry.ts`/`runtime.ts`/`http.ts`
- `src/client/` — `main.tsx`→`App.tsx` (BrowserRouter), `pages/PageView.tsx` + `page.module.css` + `tiling.ts`/`useCollageTiling.ts`, `components/` (TopNav, WidgetChrome, SettingsPanel), `hooks/` (useConfig, usePageData), `widgets/` (22 renderers + `registry.ts`, `common.module.css`), `theme/GlimpseThemeProvider.tsx`
- `src/test/setup.ts` — jsdom polyfills
- `public/` — `favicon.svg`, `icon.svg`, fonts; `dist/` — hashed Vite build (gitignored); `glance/` — reference Go app (gitignored); `docs/` + `docs/superpowers/{specs,plans}` — plans

## Development Commands
```bash
bun install
cp config.example.yml config.yml
bun run dev:server   # Bun API :3000 --watch
bun run dev          # Vite :5173 proxies /api → :3000
bun run build        # tsc --noEmit && vite build → dist/
bun run start        # Bun serves dist/ + API on :3000 (GLIMPSE_PORT, GLIMPSE_CONFIG)
bun run preview      # vite preview
bun run test         # vitest run (jsdom, globals)
bun run test:watch   # vitest watch
npx react-doctor@latest  # full scan; glance/** ignored via doctor.config.json
```
Env: `GLIMPSE_CONFIG`, `GLIMPSE_PORT=3000`, `GITHUB_TOKEN`, `TWITCH_CLIENT_ID/SECRET`, `${VAR}` in YAML. No `.env` loader (`.env*` ignored).

## Code Conventions & Common Patterns
- **Strict TS:** `strict`, `verbatimModuleSyntax`, `ES2024/ESNext/bundler`, `noEmit`. No `ReturnType` aliases, no inline casts, unconditional hooks.
- **Zod v4:** `.loose()`, `z.record()` 2 args, `.default(()=>...)`. Validate at trust boundaries; readable Zod errors surface in UI.
- **Naming:** `kebab-case` widget types, `PascalCase` components, `*.module.css` with hashed classes (e.g. `_smallColumn_1gibl_126`). `PREFERRED_SIZES[type] = {span, resizable, cols, rows}` drives bento.
- **Registry pattern:** `server/widgets/registry.ts: registerWidget(type,fn)` / `client/widgets/registry.ts: registerWidgetComponent(type,comp)` — single line per widget.
- **Async:** `Promise.allSettled` fan-out for feeds, `fetchWithRetry` + Singleflight dedupe, per-widget TTL (`cache: 5m default`), stale-on-error fallback. `usePageData` streams NDJSON, skeleton loaders.
- **Styling:** CSS Modules + Astryx tokens (`--widget-gap`, `--col-span`), `min-width:0` on grid children, fluid `clamp()` gaps. Keep `page.module.css` minimal: one `.columns` grid, spans via `--col-span`.
- **State:** No global store; `useConfig` (poll `/api/config`) + `usePageData(slug)` per page. `localStorage` for theme/todo only.

## Important Files
- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`; `src/server/index.ts`
- Config contract: `src/shared/config.ts`, `config.example.yml` (4 pages Home/Dev/Social/Lab), `src/shared/widgets/*`
- Data contract: `src/shared/api.ts` (`PagePayload`, `WidgetPayload`), `src/server/api.ts`
- Grid: `src/client/pages/PageView.tsx`, `src/client/pages/page.module.css`, `src/client/pages/tiling.ts`, `src/shared/widgets/preferredSizes.ts`
- Theme: `src/shared/theme/schemes.generated.ts`, `src/client/theme/GlimpseThemeProvider.tsx`
- Tooling: `package.json`, `vite.config.ts`, `tsconfig.json`, `doctor.config.json` (ignores `glance/**`), `.gitignore` (`dist/`, `glance/`, `config.yml`, `.env*`)

## Runtime/Tooling Preferences
- **Runtime:** Bun ≥1.3 (Bun.serve, `Bun.file`, `bun --watch`). Node not used for server.
- **Package manager:** `bun` / `bunx` (never `npm/npx`, `pip` → `uv`, `node` → `bun`). `bun.lock` is lockfile.
- **Build:** `vite` 6 + `@vitejs/plugin-react`, `vite-plugin-pwa` (`autoUpdate`, `navigateFallbackDenylist: [/^\/api\//]`, `NetworkFirst` 3s for `/api/config` & `/api/page/*`), `manualChunks: react/astryx/icons`.
- **Constraints:** `PUPPETEER_EXECUTABLE_PATH` etc. not needed; headless shared Chromium for browser tool. `glance/**` ignored everywhere.

## Testing & QA
- **Stack:** Vitest 4 + jsdom + `@testing-library/react` + `@testing-library/jest-dom`, `globals:true`, `setupFiles: ./src/test/setup.ts` (localStorage + HTMLDialogElement mocks).
- **Conventions:** One test file per widget fetcher + component (`rss.test.ts`, `rss.test.tsx`), fixtures + injected `WidgetFetchContext` fetch, `TtlCache/Singleflight` real instances; hook tests use `vi.stubGlobal(fetch)` + `vi.resetModules()` dynamic import; no mocks for logic under test.
- **Gates:** `tsc --noEmit` clean, `vitest run` green, `npx react-doctor@latest` 100/100 full scan (4 rules off: `iframe-missing-sandbox`, `no-multi-comp`, `no-fetch-in-effect`, `dangerous-html-sink`). `build` emits PWA precache 842KB.
- **Run:** `bun run test` (CI), `bun run test:watch` local, `bunx tsc --noEmit` before commit.
