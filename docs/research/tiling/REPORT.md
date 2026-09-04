# Tiling Research — REPORT (plan 005)

Base: e2c784d. Read-only research; no source changes.

## Recommendation (TL;DR)

Replace the three disagreeing systems with ONE pure placement module.
Keep the BentoGrid priority search idea, delete the JS measure pass, and derive
skeletons from the same geometry the tiles use. Concretely for plan 006:

1. Build a single pure `place(tiles, width)` module (sketch below).
2. Render tiles AND skeletons AND samples from its output — never from separate estimators.
3. Delete `useCollageTiling` and the PageView `estimateRowSpan` family.
4. CSS grid with `grid-auto-flow: dense` plus explicit spans does the packing;
   container queries handle widget interiors; breakpoints stay desktop-first.

## Findings per angle

### 1. Bento packing algorithms

For dashboards with explicit span hints, the browser grid packer is enough:
`grid-auto-flow: dense` backfills holes left by spanning tiles. A JS priority
search (current composeBento) only pays off for deterministic priority ordering
and persisted layouts. Verdict: keep ONE placer — either dense-flow CSS driven
by `place()` spans, or the existing priority search slimmed into `place()` —
but never both, and never a post-paint corrector on top.

### 2. dense vs measure-pass

- `dense` is hole-filling in a rectangular grid: no JS, stable, responsive by default.
- JS measure-and-place gives true shortest-column masonry but costs layout reads
  (thrash risk), resize handling, observer-loop guards, and post-paint shifts.
- Our widgets are NOT variable-height masonry content: heights come from config
  (span, rows, limit) plus per-type estimates. Nothing needs measuring.
- The measure pass is the direct cause of skeleton mismatch: it runs after paint
  with different row math than the skeleton estimator.

Verdict: delete the measure pass. Explicit spans plus dense flow cover the design.
### 3. Container-query interiors

Container queries (94 percent-plus browser support) let a widget adapt to its
allocated tile width instead of the viewport: same card dropped in main column,
sidebar, or split-column reflows itself. Rules for plan 006:

- `container-type: inline-size` lives on the tile wrapper, never on the element
  being queried (avoids the circular-dependency footgun).
- Use container queries ONLY for interiors (stack vs row, font scale, image ratio).
- Page-level layout (column count, spans) stays in `place()` plus media queries.
- Ship a no-query default layout first; queries are progressive enhancement.
- Name containers (`container-name`) so nested group and split-column widgets
  do not respond to an outer tile container by accident.

### 4. Skeleton-from-same-geometry

CLS guidance is unanimous: the loading state must be a visual variation of the
final layout, not a different layout — same widths, heights, gaps, grid columns,
and breakpoints; swap content in place. That is impossible with two estimators,
and trivial with one: skeleton tiles call `place()` with config-only inputs
(same spans, same width, per-type estRows) and render shimmer interiors
(existing SKELETON_SHAPE per type) inside the identical geometry. No second
clamp, no second row-unit seed, no post-paint correction.

### 5. Desktop-first responsive plus glance reference

- Glance reference: YAML pages, columns, and widgets; slim/full sizes;
  split-column with max-columns for flex-like distribution; responsive handled
  by the engine, custom CSS only as an escape hatch. No bento, no masonry.
- Take from glance: keep `columns` and `auto` CSS-only modes (flex-like, familiar,
  zero JS) and the split-column container. They are the simple path.
- Our identity: the bento mode with explicit 12-column spans — glance has nothing
  like it, and it is the visual signature worth keeping.
- Breakpoints (desktop priority, tablet and mobile nice):
  - Desktop (default, first-class): 12-col grid, cols from width via
    min-column-width clamp; explicit spans honored; dense backfill on.
  - Tablet (at or below 900px): cap at 6 cols; spans above 6 collapse to 6;
    interiors reflow via container queries.
  - Mobile (at or below 600px): single column, all spans to 1, rows auto;
    page-level media query, no JS involvement.

## Single-placement-module interface sketch

One pure, deterministic function. Same inputs give same geometry whether the
caller renders live tiles, skeleton shimmer, or sample pages.

    export interface PlaceTileInput {
      id: string;
      span: number;
      cols: number | null;
      rows: number | null;
      estRows: number;
      priority: number;
      zone: string | null;
    }

    export interface PlacedTile {
      id: string;
      col: number;
      row: number;
      w: number;
      h: number;
    }

    export interface PlacedPage {
      cols: number;
      rowUnit: number;
      tiles: PlacedTile[];
    }

    export function place(tiles: PlaceTileInput[], width: number): PlacedPage;

Semantics:

- `span` 1-4 maps to 12-col units (times 3); larger values are already units.
- `cols` null means fluid widest fit; `rows` null falls back to `estRows`.
- `estRows` comes from ONE shared per-type table (feeds, media, misc heights)
  used by tiles, skeletons, and samples alike — the current estimateRowSpan
  logic minus its private clamp, promoted to the single source of truth.
- `width` drives `cols` via the min-column-width clamp (existing chooser logic,
  minus the prefW/prefH cost terms that only served the measure pass).
- Output feeds: tile `grid-column: span w` and `grid-row: span h` styles,
  skeleton shimmer boxes, and sample-page fixtures — three consumers, one geometry.
- CSS owns packing (`dense`), wrapping (auto-fit minmax), and centering;
  JS never reads layout. Resize is a pure recompute on width change.

## Rejected alternatives

1. Keep the JS measure pass (shortest-column masonry). Rejected: forced layout
   reads risk thrash; post-paint writes shift content; needs observer-loop guards;
   and it is the root cause of skeleton mismatch. Benefit near zero for
   config-height widgets.
2. True masonry via CSS columns or a bin-pack lib. Rejected: column flow breaks
   row-wise reading and keyboard order; libs add deps (banned); neither fits
   the bento identity.
3. Clone glance flex exactly, drop bento. Rejected: bento spans are the product
   signature; glance parity lives in columns/auto modes, which we keep.
4. Draggable or persisted layouts. Rejected: out of scope; revisit only if the
   single placer survives redesign and users ask.
5. Separate skeleton estimator kept in sync by discipline. Rejected: two sources
   of truth already diverged once; the fix is structural (one geometry), not
   procedural.

## Sources

- CSS Grid spec, grid-auto-flow dense: https://www.w3.org/TR/css-grid/
- MDN grid-auto-flow: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/grid-auto-flow
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries
- web.dev Optimize CLS: https://web.dev/articles/optimize-cls
- web.dev layout thrashing: https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
- CSS Grid 3 masonry draft: https://www.w3.org/TR/2024/WD-css-grid-3-20240919/
- Glance repo and config docs: https://github.com/glanceapp/glance
