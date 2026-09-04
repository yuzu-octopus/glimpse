---
name: adding-widgets
description: Use when adding a new widget type to Glimpse, creating a server fetcher or client renderer for a widget, wiring a widget into the registries or loaders map, or when assertAllWidgetsCovered / missing-loader test failures appear after adding a type
---

# Adding a Glimpse Widget

## Overview
One widget type = touches exactly 6 places across 3 layers. Miss any registry/aggregation entry and tests fail with a list naming the gap. Copy an existing sibling widget of the same kind (feed vs config-only) as your template.

## Checklist (in order)
1. **Schema** — new `src/shared/widgets/<group>.ts` (group by kind: feeds.ts, keyed.ts, calendar.ts, or a single-widget file like todo.ts / timer.ts / radar.ts / github-trending.ts / network.ts / contribution.ts — dns/docker/system-stats/server-stats schemas live in their own files). Export `<name>Schema` (zod v4: `.loose()` where extras allowed, `z.record(z, z)` two args, `.default(() => …)` for limit) spreading `...sharedWidgetFields` so shared props exist; `NAME_DEFAULTS`; co-located `NAME_PREF` copied from `RSS_PREF` — the real Pref shape is `{cols, rows, resizable, priority, zone, preferredWidth, preferredHeight}` (`span` is a sharedWidgetFields config option, NOT a Pref field); and co-located `NAME_SKELETON` (`'list'` | `'stat'` | `'chart'` | `'rows'`). Add schema to `schemaEntries[]` in `src/shared/widgets/index.ts` (this creates the `WidgetType` union member).
2. **Registry row** — add `<name>: { schema, pref, skeleton }` to `widgetMeta` in `src/shared/widgets/index.ts`. `PREFERRED_SIZES` / `SKELETON_SHAPE` (`preferredSizes.ts`) derive from this table — never edit that file by hand. The derivation test fails listing union members with no row here.
3. **Payload types** — `src/shared/widgets/payloads.ts`: `interface <Name>Data { … }` (pure types only, no runtime imports).
4. **Server fetcher** (data widgets only; clock/bookmarks/search/todo/calendar/iframe/html/group/split-column skip this): `src/server/widgets/<name>.ts` calling `registerWidget('<name>', fn)`; add side-effect `import './<name>'` to `src/server/widgets/index.ts`. Use `fetchJson`/`fetchText` from `./http` (retry+timeout built in), `ctx.singleflight.run(key, …)`, `Promise.allSettled` for fan-out, `sanitizeUrl()` in every thrown error message. Config arrives pre-validated — do NOT re-default `limit`.
5. **Client renderer** — `src/client/widgets/<name>/index.tsx`: component + `registerWidgetComponent('<name>', Component)` at module scope. Loading idiom: `isLoading ?? (data == null && !error)` passed to `WidgetChrome` (which takes `children`, not an items prop); render list rows via the shared `Feed` module. Add loader entry to `widgetLoaders` in `src/client/widgets/index.ts` (`() => import('./<name>')`) — lazy chunk, no static import.
6. **Tests ×3** — schema test next to the schema file, fetcher test `src/server/widgets/<name>.test.ts` (inject a fake `WidgetFetchContext`: fixtures + fake fetch, zero network — template: `rss.test.ts`), component test `src/client/widgets/<name>/<name>.test.tsx`.

## Quick reference
| Concern | Answer |
|---|---|
| Cache key | `${pageSlug}:${path}` — built by `fetchWidget`, not you |
| TTL | `config.cache` string → `parseCacheDuration(v, fallbackMs)`; else `getDefaultTtl(type)` |
| Stale-on-error | automatic via `fetchWidgetData` — throw normally on failure |
| Container widgets | `group`/`split-column`: declare `widgets` array in schema; builder recurses children, no fetcher |
| Live polling | add type to LIVE_TYPES in `src/shared/live.ts` only if it needs 30s client polls |

## Common mistakes
- Forgetting step 1's `schemaEntries` append → type exists nowhere; zod rejects the config.
- Forgetting step 5's `widgetLoaders` entry → component renders "not implemented" (or Suspense hangs in older checkouts).
- Static-importing the renderer anywhere → defeats code splitting.
- Reading `limit` without trusting the schema default → double defaults drift.
- Inventing Astryx props — only APIs in `node_modules/@astryxdesign/core/dist/**/*.d.ts` exist.
