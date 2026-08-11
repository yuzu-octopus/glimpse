# Tiling Design — responsive widget layout for Glimpse

Status: proposal. Read-only research; no source changes.

## 1. Current behavior + pain points

Today Glimpse mirrors glance's column model exactly:

- `PageView` renders `.page` (max-width 1600/1100/1920px via `WIDTHS`, `src/client/pages/PageView.tsx:12,170-171`), optional head-widgets grid, then `.columns` (`PageView.tsx:184`).
- `.columns` is a flex row with `gap: var(--widget-gap)` (`page.module.css:45-48`). Each config column becomes a `MobileColumn` with either `.fullColumn` (`width:100%`, `page.module.css:54-57`) or `.smallColumn` (`width:300px; flex-shrink:0`, `page.module.css:59-62`). Multiple `full` columns shrink equally via flex.
- An inline `gridTemplateColumns` on `.columns` (`PageView.tsx:188-190`) is inert decoration, kept only for a pinned test assertion.
- `@media (max-width:768px)` stacks columns, widens small columns to 100%, and shows the per-column collapse toggle (`page.module.css:160-168`).
- Config: `columns` is an array of `{size: 'small'|'full', widgets}` with `.min(1).max(3)` (`src/shared/config.ts:6-13`); page `width` is `default|slim|wide` (`config.ts:9`). `ColumnPayload.size` mirrors this in `src/shared/api.ts:16-21`.

Pain points:

1. **No auto-balancing.** A page with 3 `small` columns always renders 3×300px side by side, even on a 1920px `wide` page where that looks sparse. Column count is fixed by the config author, never by viewport.
2. **Masonry is unreachable at page level.** Glimpse has no page-level tiling mode; the only masonry is glance's `split-column` widget. A user who wants a 4-5 column wall has to fake it with `split-column` nesting.
3. **Mixed-size columns don't reflow.** `small`+`full` layouts are rigid; on a `slim` page (1100px) a 300px+full split can leave the full column cramped while the small column wastes space.
4. **768px breakpoint is viewport-based, not width-based.** A `slim` page in a half-screen desktop window keeps its side-by-side columns down to 768px even though the content box is already ~500px.
5. **No width-derived adaptivity.** Widgets inside columns get fixed-width columns regardless of available space; glance adapts inner widget layout via container queries (see §2) — Glimpse has none (`container-type` grep: zero hits in `src/`).

## 2. Glance behavior analysis

Citations are relative to `./glance` (reference repo, read-only).

**Column model (fixed, config-driven):**

- `internal/glance/templates/page-content.html:12-20` — each page renders `.page-columns` > `.page-column page-column-{{ .Size }}`.
- `internal/glance/static/css/site.css:135-148` — `.page-column-small{width:300px;flex-shrink:0}`, `.page-column-full{width:100%;min-width:0}`, `.page-columns{display:flex;gap:var(--widget-gap)}`. Two `full` columns share evenly through flex shrink. This is exactly what Glimpse ports.
- `docs/configuration.md:528` — "up to 3 columns"; `:631` — sizes are `full`/`small`, "must have either 1 or 2 full columns"; `:578` — `width: slim` caps at 2 columns.

**Mobile: hard collapse, no reflow:**

- `internal/glance/static/css/mobile.css:1-16` — at `max-width:1190px`: desktop nav hidden; `.page-column-small{width:100%;flex-shrink:1}`; **all** `.page-column{display:none}`.
- `mobile.css:58-61` — `body:has(.mobile-navigation-input[value="N"]:checked) .page-columns > :nth-child(N+1){display:block}` — a fixed bottom tab bar reveals **one column at a time**. Glance does not keep columns side by side on mobile; it swaps to a single-column, tab-navigated view.
- `mobile.css:102-107` — at `max-width:550px`: root font shrinks to 9.4px, `--widget-gap:15px`, `--content-bounds-padding:10px`, and `.dynamic-columns` forced to 1 column per row.

**Masonry — JS, widget-level only:**

- `internal/glance/templates/split-column.html:6` — `.masonry` with `data-max-columns` (from the `split-column` widget's `max-columns` config).
- `internal/glance/static/js/masonry.js:15-37` — `columnsCount = clamp(floor(container.offsetWidth / minColumnWidth), 1, min(maxColumns, items.length))`, default `minColumnWidth: 330`; items distributed round-robin (`i % columnsCount`) into `.masonry-column` flex columns; re-render on `ResizeObserver`. So glance's masonry is **count-balanced, not height-balanced**, and lives only inside the split-column widget. Docs show it used as a page trick: `configuration.md:1420-1421` ("Masonry layout with up to 5 columns... via `split-column` + `max-columns`").

**Container queries — the real adaptivity mechanism:**

- `internal/glance/static/css/widgets.css:52-55` — `.widget-content{container-type:inline-size;container-name:widget}`. Every widget's content is a query container.
- `internal/glance/static/css/utils.css:60-118` — `.dynamic-columns` is a grid driven by `--columns-per-row`, set by `:has(> :nth-child(N))` rules combined with `@container widget` width bands (`≤599 / 600-849 / 850-1249 / 1250-1499 / ≥1500`), so multi-column *widget interiors* (bookmarks, markets, monitor, docker) adapt to the width they actually get.
- `utils.css:119-177` — `.cards-grid` / `.cards-horizontal` (videos, RSS horizontal cards) step `--cards-per-row` down across the same `@container widget` bands.

**Summary:** glance's responsive story is (a) fixed 3-column flex with `full`/`small`, (b) a hard single-column collapse + tab nav at 1190px, (c) container-query adaptivity *inside* widgets, (d) masonry only as a JS split-column widget. There is **no page-level auto-reflow** in glance — the content column structure is always what the YAML says. This is freedom for us: auto tiling is a pure superset, no glance config breaks.

## 3. Candidate strategies

**A. Pure CSS grid auto-fill/auto-fit** — `.columns` becomes `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`; column count follows the content width continuously, zero JS.
- Pros: one CSS change, no measurement, no hydration concerns, adapts to `slim`/`wide`/window size automatically (fixes pain point 4 for free).
- Cons: `auto-fit` wraps row-major, so visual order changes vs config; all columns become equal tiles — the `small`/`full` distinction is lost in this mode (fine if auto is opt-in); grid rows equalize heights unless `align-items:start` (which we want anyway).

**B. Container-query auto columns with config override (recommended)** — A. plus making `.columns` a query container and letting config override the mechanism:
- `.columns{container-type:inline-size}`; auto mode uses `repeat(auto-fit, minmax(var(--min-column-width,300px), 1fr))` with `align-items:start`.
- New optional config: `tiling: columns|auto` (default `columns` = today's behavior, byte-for-byte glance-compatible) and `min-column-width` (auto mode only). Optional per-column `span` hint for auto mode (`grid-column: span N`).
- Why container-type at all if auto-fit doesn't need it? (1) It makes the page a proper query container so widget-internal container queries (glance's `@container widget` pattern, which we'll want for the RSS/markets-style widgets) respond to real column width instead of viewport. (2) It future-proofs a band-snapped variant (`@container page-columns` setting `--columns-per-row` like glance's `dynamic-columns`, giving stable snapped column widths instead of continuous wrap) — a later refinement, not in v1.
- Pros: config-controlled superset (defaults preserve current behavior exactly), viewport- and page-width-aware, no JS, no hydration risk, keeps `MobileColumn`/mobile toggles (columns stay DOM children).
- Cons: container-query layout is unmeasurable in jsdom (testing constraints, §6); auto mode ignores `small`/`full` (documented: auto = balanced tiles, explicit = glance semantics).

**C. JS ResizeObserver masonry (port `masonry.js`)** — page-level JS distribution into flex columns.
- Pros: proven glance pattern; lets us literally reuse `masonry.js` behavior.
- Cons: JS reflow + ResizeObserver wiring, layout flash before first measure, more code, hydration complexity, and glance itself scopes masonry to a widget — page-level masonry would diverge from glance's own architecture. Rejected for v1; the split-column widget (already planned for parity) covers the glance-visible masonry use case.

**Recommendation: B.** Zero-JS, config-overridable, glance-superset, and it unblocks widget-internal container queries for free.

## 4. Proposed config surface

Defaults preserve current behavior; glance configs keep parsing unchanged.

```yaml
pages:
  - name: Home
    width: wide
    tiling: auto                # NEW, optional. 'columns' (default) = glance behavior
    min-column-width: 340       # NEW, optional. Auto mode only; default 300
    columns:
      - size: small             # 'small'/'full' still honored in 'columns' mode;
        widgets: [...]          # ignored in 'auto' mode (all tiles equal)
      - size: small
        span: 2                 # NEW, optional. Auto mode only: this tile spans 2 tracks
        widgets: [...]
      - size: small
        widgets: [...]
```

Rejected alternative: `columns: auto` as a string. It forces `z.union([array, literal])` on `columns`, complicates the payload type, and abandons glance's required `columns: [{size, widgets}]` shape. `tiling` keeps `columns` a plain array.

Zod sketch (`src/shared/config.ts`):

```ts
export const ColumnSchema = z.object({
  size: z.enum(['small', 'full']),
  widgets: z.array(WidgetSchema),
  // NEW — auto tiling only; number of grid tracks this column spans.
  span: z.number().int().min(1).max(4).optional(),
});

export const PageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  width: z.enum(['default', 'slim', 'wide']).optional(),
  'desktop-navigation-width': z.enum(['default', 'slim', 'wide']).optional(),
  'center-vertically': z.boolean().optional(),
  'hide-desktop-navigation': z.boolean().optional(),
  'show-mobile-header': z.boolean().optional(),
  'head-widgets': z.array(WidgetSchema).optional(),
  // NEW — 'columns' (default) = current flex behavior; 'auto' = balanced tiles.
  tiling: z.enum(['columns', 'auto']).optional(),
  // NEW — auto mode only; min track width for auto-fit, default 300.
  'min-column-width': z.number().positive().optional(),
  columns: z.array(ColumnSchema).min(1).max(3),
});
```

Payload (`src/shared/api.ts`): `PagePayload` gains `tiling?: 'columns' | 'auto'` and `minColumnWidth?: number`; `ColumnPayload` gains `span?: number`. Server passes them through from config (defaults resolved server-side: `tiling: 'columns'`, `minColumnWidth: 300`).

Open question (flag for implementer): allow `.max(5)` columns when `tiling: 'auto'`? Glance caps at 3 (parity). Auto mode's whole point is more, narrower tiles; but relaxing the cap diverges from glance validation. Recommend: keep 3 for v1, revisit if users ask.

## 5. Implementation sketch

Component (`src/client/pages/PageView.tsx`):

- Pass `tiling`/`minColumnWidth`/`span` through `PagePayload` (no shape change to `ColumnPayload` beyond `span`).
- On `.columns`, when `data.tiling === 'auto'`: add `styles.autoTiling` class and set `style={{ '--min-column-width': `${data.minColumnWidth ?? 300}px` }}`; per column, set `data-span={col.span ?? 1}` (or a `gridColumn` class).
- `MobileColumn` unchanged — toggles still work; in auto mode every column is a tile.
- The inert inline `gridTemplateColumns` (pinned test) stays untouched.

CSS (`src/client/pages/page.module.css`):

```css
.columns {
  display: flex;
  gap: var(--widget-gap);
  container-type: inline-size; /* make the page a query container */
}

.autoTiling {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--min-column-width, 300px), 1fr));
  align-items: start; /* ragged bottoms = masonry aesthetic; no row equalization */
}

/* neutralize fixed widths in auto mode */
.autoTiling .smallColumn,
.autoTiling .fullColumn {
  width: 100%;
  flex-shrink: 1;
}

.autoTiling [data-span='2'] { grid-column: span 2; }

@media (max-width: 768px) {
  /* existing rule; in auto mode grid still holds — force single track */
  .autoTiling { grid-template-columns: 1fr; }
}
```

Breakpoints: keep 768px for the mobile stack (unchanged scope). A follow-up (separate from tiling) should align the mobile collapse with glance's 1190px + tab nav — flagged in §6. Above 768px the auto grid reflows continuously with window width, which also fixes the `slim`-page-in-small-window case (pain point 4). No JS, no ResizeObserver, no hydration risk.

## 6. Risks + testing plan

Risks:

1. **jsdom cannot compute layout.** Container queries, `auto-fit` track math, `@container` — none are evaluable in jsdom. Unit tests must assert config→DOM mapping only: `tiling: 'auto'` yields the `autoTiling` class; `min-column-width` yields the CSS var; `span` yields `data-span`. Never assert computed geometry.
2. **Real behavior needs browser verification.** Playwright: resize viewport through 380/768/1024/1440/1920, assert column count changes at expected widths, no horizontal scrollbar, `slim` page (1100px) auto-tiles below its `wide` sibling at the same viewport, mobile toggles still collapse columns, `span` tiles wrap cleanly when tracks run out.
3. **`container-type: inline-size` on `.columns`** applies layout+inline-size containment to the columns box — children (widgets) cannot escape it. Safe here (columns are plain blocks) but worth a visual pass for any widget using `position: sticky` (glance has none inside columns).
4. **Auto mode ignores `small`/`full`.** Documented tradeoff; explicit mode is the escape hatch. Mixed "sidebar + content" layouts must stay in `tiling: columns`.
5. **Row-major reordering.** In auto mode, visual order follows grid flow, not config column order. Acceptable (glance's masonry reorders too); document.
6. **Pinned test.** `PageView.test.tsx` asserts the inline `gridTemplateColumns` string — unchanged by this design; keep the assertion.

Testing plan:

- Vitest+RTL (jsdom): schema defaults (`tiling` undefined → `columns`; `min-column-width` default 300), class/var/data-attr mapping, `span` passthrough, existing tests untouched.
- Browser (Playwright, manual or `webapp-testing`): the matrix in risk 2. This is the only place container-query layout is provable.

Follow-up (out of scope): align mobile breakpoint with glance (1190px, tab nav), widget-internal container queries (`@container widget` bands) for multi-column widget interiors, band-snapped column counts if continuous wrap proves visually noisy.

---

# Magic tiling (v2)

Status: proposal. Read-only research; no source changes.

## 1. Why v1 `tiling: auto` isn't "magical" yet

v1 (`page.module.css:48-90`, shipped) is an equal-tile grid: `repeat(auto-fit, minmax(min(300px, 100%), 1fr))` + `align-items: start`. It fixes column-count adaptivity but reads as "spreadsheet, but responsive":

1. **No hole-filling.** `grid-auto-flow: row` (the default) leaves a gap whenever a `span: 2` tile doesn't fit the remaining tracks; the tile wraps to the next row and the hole stays empty.
2. **No auto spans.** The `span` hint is manual config. Nothing adapts a tile's footprint to its content, so a 20-item RSS feed occupies the same cell as a clock. Rows are equalized to their tallest item; shorter tiles leave dead whitespace below them inside the row — the opposite of a packed collage.
3. **Row-major ≠ reading flow.** Dashboard "magic" (Home Assistant, Grafana, Vercel bento) packs by *height*, not by row.

Glance's own masonry (`glance/internal/glance/static/js/masonry.js`) is also not the answer at page level: it is count-balanced round-robin into flex columns, equal-width items only, widget-scoped, and JS-driven (layout flash + hydration cost). It proves the *mechanism* (ResizeObserver re-render) but not a collage aesthetic.

## 2. Candidate techniques (2026)

| Technique | Chrome | Firefox | Safari | Order | Perf | Config control | Verdict |
|---|---|---|---|---|---|---|---|
| CSS grid `grid-auto-flow: dense` + spans | 57+ ✅ | 52+ ✅ | 10.1+ ✅ | relative order kept (dense may backfill earlier) | native, zero JS | via `span` | **base layer — ship** |
| CSS multi-column (`columns: N` + `break-inside: avoid`) | ✅ | ✅ | ✅ | **broken** (top-to-bottom per column; LTR readers see 1,4,7…) | native | no spans possible | reject (order is fatal for dashboards) |
| JS height-balanced masonry (Pinterest-style, shortest-column) | ✅ | ✅ | ✅ | column-major | JS reflow + flash | none needed | good for feeds; equal-width only — glance's split-column already covers the niche |
| Native masonry `grid-template-rows: masonry` | flag | flag (moving off) | flag | kept | native | spans on defined axis | **not production** — spec churn |
| Native `display: masonry` (Chromium/WebKit proposal) | flag | — | flag | kept | native | same | abandoned — see below |
| Native `display: grid-lanes` (CSS Grid L3, resolved Nov 2025) | none | none | TP only | kept | native | full grid placement | future (2027+ at earliest); **design so this is a drop-in later** |
| Fixed bento cell templates (hand-authored 12-col) | ✅ | ✅ | ✅ | exact | native | total, but manual | reject — requires per-page art direction, not glance-config-friendly |

Sources: sitepoint.com/css-masonry-layout-native-grid (Feb 2026); bordermedia.org/blog/css-masonry-syntax-wars (Jan 2026, CSSWG Nov 2025 resolution); caniuse `masonry` (Chrome not supported through 150).

Key finding: native masonry is *unresolved* — Firefox wanted `grid-template-rows: masonry`, Chromium/WebKit wanted `display: masonry`, and the CSSWG resolved to a new `display: grid-lanes` in Nov 2025, currently Safari-TP-only. Building on it today means a flag-gated layout for most users. But the resolution tells us the *shape* of the future: tracks on one axis, free flow on the other, hole-free by spec.

## 3. RECOMMENDED approach — `tiling: collage` (bento grid, dense flow + JS-measured row spans)

Two layers; the first is a free upgrade to v1, the second is the actual "magic".

**Layer 1 (CSS, zero JS — do now):** add `grid-auto-flow: dense` to `.autoTiling`. One line; every existing `span` config stops leaving holes. Keeps v1 semantics; strict superset.

**Layer 2 (JS, opt-in via new mode):** `tiling: collage` = dense grid + a small ResizeObserver pass that makes footprints follow content:

- Grid: `repeat(auto-fit, minmax(var(--min-column-width), 1fr))`, `grid-auto-flow: dense`, `grid-auto-rows: var(--tile-row)`, `align-items: stretch` (tiles fill their spanned cell).
- Measure: on container resize and after data hydration (one `requestAnimationFrame` pass), read each tile's content height, compute `rowSpan = clamp(round(h / rowUnit), 1, 4)` with `rowUnit = min(tile heights)` at that pass, then set `grid-row: span N` inline. The shortest tile is the unit, so the smallest widget is always exactly 1×1 and everything else scales off it.
- `span` (config, 1-4) remains a *minimum column footprint* hint; `rowSpan` is auto. Config authors can force a hero tile (`span: 2`) and the layout packs everything else around it.
- Re-render guard identical to glance's `masonry.js` (`columnsCount`/`rowSpans` change check + `ResizeObserver` → `requestAnimationFrame`); ~50-70 lines, mirrors an existing codebase pattern, no new deps.
- Degradation: JS disabled/failed → grid still renders with `grid-auto-flow: dense` and `grid-auto-rows: auto` fallback (layer 1 look). No `@supports` needed — every browser here supports dense grid.

**Why not pure JS masonry or pure dense grid?** Pure masonry is column-major (breaks dashboard reading order) and equal-width (wasteful for a 3-tile-wide hero). Pure dense grid without measured spans keeps the equal-cell look. Bento = dense grid + row spans: hole-free *and* height-aware *and* order-preserving in the flow sense.

**Config surface** (glance-compat preserved; default `columns` byte-for-byte unchanged):

```yaml
pages:
  - name: Home
    tiling: collage          # NEW. 'columns' (default) | 'auto' (v1) | 'collage' (v2)
    min-column-width: 340    # shared with 'auto'; default 300
    columns:
      - size: small
        span: 2              # existing hint; collage = min column footprint
        widgets: [...]
      - size: small
        widgets: [...]
```

Schema: extend `tiling` enum with `'collage'` (`src/shared/config.ts`, `src/shared/api.ts` pass-through, defaults resolved server-side as today). No new per-widget keys — the whole point is zero-config magic; `span` stays as the only knob. Open question (flag for implementer): add optional `tile-row-height` (px) to override the measured `rowUnit` when the shortest widget is an outlier (e.g. a single-line clock making every other tile 3 rows tall). Defer until a real config asks for it.

**Composition with existing machinery:**

- *Skeleton mirroring* (`PageSkeleton`): emit estimated `rowSpan` from config-only heuristics (widget type + declared item counts — e.g. RSS/HN/Reddit with many items → taller) so first paint approximates the collage; accept one re-measure frame on hydration. This is the one place v2 adds CLS risk (see §4.1); the estimate bounds it.
- *Mobile collapse*: below 768px the single-track rule already wins; force `grid-row: span 1` in that media query so measured spans can't overflow the single column.
- *`span` + dense interplay*: document that a `span: 3-4` on a narrow container wraps (dense backfills beside it); same caveat as v1 risk 5.
- *Widget-internal container queries*: unaffected; `container-type: inline-size` on `.columns` already in place.
- *Future grid-lanes*: `display: grid-lanes` replaces the grid+JS layer wholesale when it ships (track list = `minmax(min-column-width, 1fr)`, everything else falls out). Keep the JS isolated in one module so the swap is a CSS class change.

## 4. Risks + testing plan

**Risks**

1. **CLS on hydration** — measured spans land after data loads; skeleton estimates minimize but don't eliminate shift. Mitigate: only run the measure pass once per container-width + data-settle (not per scroll), and keep `rowSpan` churn bounded (round to 1-4).
2. **jsdom cannot compute layout** — as v1: unit tests assert config→DOM mapping only (`tiling: 'collage'` → `collageTiling` class + dense flag; `span` → `data-span`; measured `rowSpan` is an inline style set by a mocked measure fn). Never assert geometry.
3. **ResizeObserver loop** — setting inline `grid-row` changes heights, which re-triggers observation. Guard with the same change-detection as glance (`if spans unchanged return`) + `requestAnimationFrame` coalescing; cap re-renders per second as a backstop.
4. **Dense backfill reorders visually** — a `span: 2` tile can render earlier than its DOM position (screen-reader order = DOM order, mismatch). Acceptable and documented (v1 risk 5, same shape); the collage look *requires* it.
5. **Outlier shortest tile skews the row unit** — one tiny widget inflates every other tile's span. Deferred knob (`tile-row-height`) noted above; v1 ships with `rowUnit = min(tile heights)` and we watch real configs.

**Testing plan**

- Vitest+RTL (jsdom): enum schema accepts `'collage'` and rejects junk; `PageView` maps `tiling: 'collage'` → `collageTiling` class; `span` → `data-span`; measure module unit-tested with fixed fake heights (span computation, clamp 1-4, no-change guard). Existing assertions untouched (`gridTemplateColumns` pin stays).
- Browser (Playwright): the v1 matrix plus — collage packs hole-free (assert every tile's bounding box touches either container edge or a sibling tile: no orphan gaps), container height strictly ≤ equal-tile grid for the same content, spans update on container resize (1440↔1920) and after feed data settles, mobile 380px renders single column with `grid-row: span 1`, keyboard tab order still visits every tile.
- Perf: measure pass must stay under one frame at 30+ tiles; verify no continuous ResizeObserver churn in DevTools Performance.

Follow-up (out of scope): adopt `display: grid-lanes` when two engines ship it unflagged (swap is isolated by design); per-widget `span` presets in config.example.yml showcasing collage; optional `tile-row-height` override if real configs hit risk 5.
