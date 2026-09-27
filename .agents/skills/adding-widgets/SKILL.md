---
name: adding-widgets
description: Use when adding a new widget type to Glimpse, creating a server fetcher or client renderer for a widget, wiring a widget into the registries or loaders map, or when widgetMeta derivation / registry-coverage test failures appear after adding a type
---

# Adding a Glimpse Widget

## Overview
One widget type touches six places across three layers. Five of them are mechanical and the generator writes them; the sixth is the part that decides whether the widget looks like Glimpse or like a stranger. Miss a registry entry and `registry-coverage.test.ts` fails naming the gap by widget type — silent absence is impossible. Copy the closest existing sibling (feed vs config-only vs container) as your template.

## Checklist (in order)
0. **Run the generator first.** `bun run new-widget <kebab-name>` scaffolds and wires, in one shot: `src/shared/widgets/<name>.ts` (DEFAULTS + PREF + SKELETON + `.loose()` schema + `XConfig` type), the three `src/shared/widgets/index.ts` edits (import, `schemaEntries` append, `widgetMeta` row), `src/server/widgets/<name>.ts` (`registerWidget`), `src/server/widgets/<name>.test.ts`, the `src/server/widgets/index.ts` side-effect import, `src/client/widgets/<name>/index.tsx` (`registerWidgetComponent`), `src/client/widgets/<name>/<name>.test.tsx`, and the `widgetLoaders` entry. It prints a YAML snippet and refuses to overwrite existing files. Then hand-finish steps 1–6 — the scaffold is a compiling stub, not a finished widget.
1. **Schema, with the pref and skeleton co-located.** The generator writes one file per widget; hand-written schemas group by kind (`feeds.ts`, `keyed.ts`, `calendar.ts`, `media.ts`, `twitch.ts`, `clock.ts`, …). Spread `...sharedWidgetFields` so every shared prop exists for free — `title`, `title-url`, `hide-header`, `cache`, `css-class`, `retries` (0–10, default 3), `show-errors` (default true) plus the bento hints `priority`/`span`/`zone`. The real `Pref` shape is `{cols, rows, resizable, priority, zone, preferredWidth, preferredHeight}` — `span` is a shared config option, **not** a Pref field. `<NAME>_SKELETON` is `'list' | 'stat' | 'chart' | 'rows'`; pick the silhouette the widget actually loads into, since `PageSkeleton` mirrors the ready grid.
2. **`widgetMeta` row** — `{ schema, pref, skeleton }` in `src/shared/widgets/index.ts`. `PREFERRED_SIZES` / `SKELETON_SHAPE` (`preferredSizes.ts`) derive from this table; never edit that file by hand. The derivation test fails listing union members with no row.
3. **Payload type** — `src/shared/widgets/payloads.ts`: `interface <Name>Data { … }`, pure types only, no runtime imports. The generator declares it inline in the server file instead; move it here when the client needs it, which is every non-trivial widget.
4. **Server fetcher** (data widgets only — clock, bookmarks, search, todo, calendar, iframe, html, timer, notepad, group, split-column skip it and are listed in `CONFIG_ONLY` in `registry-coverage.test.ts`): `src/server/widgets/<name>.ts` calling `registerWidget('<name>', fn)`. Use `fetchJson`/`fetchText` from `./http` (retry + timeout built in) and hand it `retryOptionsFrom(cfg)` so the widget's `retries` reaches the wire; `ctx.singleflight.run(key, …)`, `Promise.allSettled` for fan-out, `sanitizeUrl()` in every thrown error message. Config arrives pre-validated — do NOT re-default `limit`.
5. **Client renderer** — `src/client/widgets/<name>/index.tsx`: component + `registerWidgetComponent('<name>', Component)` at module scope, plus a `widgetLoaders` entry in `src/client/widgets/index.ts` (`() => import('./<name>')` — lazy chunk, no static import). Loading idiom: `isLoading ?? (data == null && !error)` passed to `WidgetChrome` (which takes `children`, not an `items` prop, when you have a list). **Pass `showErrors={cfg['show-errors']}`** — the generator's stub does not, and a renderer that forgets it renders loudly even when the config asked for quiet.
6. **Tests** — fetcher test `src/server/widgets/<name>.test.ts` (inject a fake `WidgetFetchContext`: fixtures + fake fetch, zero network — template: `rss.test.ts`), component test `src/client/widgets/<name>/<name>.test.tsx`. Add a schema test beside the schema when the widget has rules worth pinning — a judgement call, not a quota.
7. **Green the guards** — `bun run check-config` for the schema, and `bun run test` for `registry-coverage` (a `WidgetType` needs a server import unless `CONFIG_ONLY`, and a `widgetLoaders` entry unless it is a container; an orphan on either side fails too).

## House style (post-minimisation)
The visual-minimisation waves rewrote the rules below. A widget that follows the old ones reads as foreign.
1. **Kit components before custom CSS.** A hand-rolled button, badge, meter, checkbox or toggle is a defect. `Button`, `IconButton`, `Badge`, `StatusDot`, `ProgressBar`, `CheckboxInput`, `TextInput`, `Stack`, `HStack`, `Grid`, `Text` come from `@astryxdesign/core/*`; row/list shells are `Stack`/`Grid`/`HStack`, not `<div>`s with gap classes. The shared feed module (`client/widgets/feed/feed.tsx`) already gives you list / grid / row layouts, thumbnails, source headers and tag chips — use it instead of re-deriving a feed.
2. **Charts use the kit's chart components and `CHART_HUES`, never hand-rolled hues.** Import from `src/client/kit/`: `Sparkline` (unique `label` per instance; `mode: 'max'` for fixed-geometry dashboard tiles, `'range'` for market rows), `MetricDelta` (the one KPI-delta pattern), `CHART_HUES` (`cyan`/`orange`/`green`/`pink`/`muted`, all token vars, **purple-free by construction** — purple means tappable, never data). Sequential encodings (a contribution heatmap) use the `--color-data-<family>-<1..5>` ramps. Only write a raw SVG when none of the three fits, and then a test with it.
3. **Colour is assigned by identity, not position.** Tag and bookmark chips hash their text/URL through `tagAccent()` (`client/widgets/feed/tag-accent.ts`); `:nth-child` colour cycling was removed because it made the same tag a different colour per row. If you introduce a second coloured identity, hash it the same way.
4. **Status colours are semantic.** green positive · red negative · yellow tag/warning · cyan info · orange attention. Surfaces are the 10% washes plus a semantic border, never a direct fill; a `StatusDot` beats a coloured `<span>`.
5. **Flat and crisp.** 5px element radii, `rx=4` on chart bars, no pills, **no soft grey shadows** — depth comes from borders and separators. No entrance animation ladders, no card hover lifts; hover dims, press dims more.
6. **Nothing meaningful below 12px** (13px for chart labels). Layout on 8px multiples, small elements on the 4px half-step; `--space-gap` 24, `--widget-content-*` 16/16, `--tile-row` 96 come from tokens — don't re-pick them.
7. **No hexes, ever.** Not in a CSS module, not in a stylesheet, not in `custom-css-file`. The `astryx-dracula` kit owns every colour; new colour need is a kit change, not a one-off. The one valid API reference is `node_modules/@astryxdesign/core/dist/**/*.d.ts`.

## Quick reference
| Concern | Answer |
|---|---|
| Cache key | `${pageSlug}:${path}` — built by `fetchWidget`, not you |
| TTL | `config.cache` string → `parseCacheDuration(v, fallbackMs)`; else `getDefaultTtl(type)` |
| Retries | `config.retries` → `retryOptionsFrom(cfg)` → `fetchWithRetry`; `0` = one attempt |
| Quiet failures | `config['show-errors']: false` → `WidgetChrome showErrors={false}`; the header StatusDot still reports it |
| Stale-on-error | automatic via `fetchWidgetData` — throw normally on failure |
| Container widgets | `group` (≥1 child) / `split-column` (≥2 children, `max-columns` to cap the row): declare a `widgets` array in the schema; the builder recurses, no fetcher |
| Glance type aliases | `to-do` → `todo`, `stocks` → `markets`, folded in `shared/widgets/aliases.ts` before the union discriminates. Registry keys stay canonical. |
| Live polling | add the type to `LIVE_TYPES` in `src/shared/live.ts` only if it needs 30s client polls |

## Common mistakes
- Skipping the generator and hand-wiring only part of the registry — the coverage test names the gap, but only after you run it.
- Forgetting the `schemaEntries` append → the type exists nowhere and zod rejects the config.
- Forgetting the `widgetLoaders` entry → the component never resolves and Suspense hangs.
- Static-importing the renderer anywhere → defeats code splitting.
- Reading `limit` without trusting the schema default → double defaults drift.
- Leaving the generator's `WidgetChrome` stub as-is: it omits `showErrors`, has no `Feed` usage, and its `Row` is a `<div>` where a kit `Stack` belongs.
- Inventing Astryx props — only APIs in `node_modules/@astryxdesign/core/dist/**/*.d.ts` exist; the `skill://astryx` doc describes an invented API.
- Hardcoding a hex or defining a `--color-*` var in the widget's CSS module — the `astryx-dracula` kit owns every colour.
- Hand-rolling a chart's colours, axes or KPI delta when `src/client/kit/` already has all three.
- Cycling chip colour by `:nth-child` — hash the identity via `tagAccent()` instead.
