import type { CSSProperties } from 'react';
import styles from './page.module.css';
import { PREFERRED_SIZES } from '../../shared/widgets/preferredSizes';

/**
 * Single placement module — the ONLY geometry source for page tiling.
 *
 * `place(tiles, width)` is a pure, deterministic function: same inputs give
 * the same geometry whether the caller renders live tiles, skeleton shimmer,
 * or sample pages. Tiles and skeletons never estimate separately.
 *
 * - `columns` / `auto` modes are CSS-only (no `place()` call): rows are auto
 *   on both sides, widths share the same span derivation, so there is nothing
 *   to diverge.
 * - `collage` columns and flat `widgets` (pure bento) render `place()` output
 *   as `grid-column: span w` / `grid-row: span h` (+ explicit x/y for bento).
 * - CSS owns packing (`grid-auto-flow: dense`), wrapping, and centering.
 *   Nothing here reads layout; resize is a pure recompute on width change.
 *
 * Breakpoints (desktop-first): 12 tracks above 900px, 6 at or below 900px,
 * 1 at or below 600px. The same caps apply in `place()` and in CSS, so JS
 * geometry and the no-JS fallback agree.
 */

/** Tracks on desktop (default, first-class). */
export const DESKTOP_COLS = 12;
/** Tracks on tablet (at or below TABLET_MAX_WIDTH). */
export const TABLET_COLS = 6;
/** Tracks on mobile (at or below MOBILE_MAX_WIDTH). */
export const MOBILE_COLS = 1;
/** Tablet breakpoint upper bound (px). */
export const TABLET_MAX_WIDTH = 900;
/** Mobile breakpoint upper bound (px). */
export const MOBILE_MAX_WIDTH = 600;

/** Single row-unit seed (px) — matches the `--tile-row` density token. */
export const ROW_UNIT = 96;
/** Row-span clamp — the one and only clamp, applied inside `place()`. */
export const ROW_SPAN_MIN = 1;
export const ROW_SPAN_MAX = 8;

/** Default minimum tile width (px) for the CSS-only `auto` mode. */
export const MIN_COLUMN_WIDTH_DEFAULT = 300;

/** One tile's config-only inputs to the placer. */
export interface PlaceTileInput {
  id: string;
  /** Width hint: 1-4 legacy bento spans map to 12-col units (x3); column
   * spans are already 12-col units. See `spanToUnits`. */
  span: number;
  /** Explicit width in grid columns; null = fluid (widest fit from span). */
  cols: number | null;
  /** Explicit height in row units; null falls back to `estRows`. */
  rows: number | null;
  /** Per-type height estimate — always from `estRowsFor`, the single table. */
  estRows: number;
  priority: number;
  zone: string | null;
}

/** Placed footprint: 0-based col/row origin plus w/h spans. */
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
  /** Input order — look up by id. */
  tiles: PlacedTile[];
}

/** Track count for a container width: 12 / 6 / 1 breakpoints. */
export function trackCountForWidth(width: number): number {
  if (!(width > 0)) return DESKTOP_COLS;
  if (width <= MOBILE_MAX_WIDTH) return MOBILE_COLS;
  if (width <= TABLET_MAX_WIDTH) return TABLET_COLS;
  return DESKTOP_COLS;
}

/**
 * Width hint to 12-col units. Legacy 1-4 bento spans (and fluid fallbacks)
 * scale x3; larger values are already 12-col units (config `span: 3/4/6/8`).
 */
export function spanToUnits(span: number): number {
  const raw = Math.min(Math.max(Math.floor(span) || 1, 1), DESKTOP_COLS);
  return raw <= 4 ? raw * 3 : raw;
}

type PrefRow = { rows?: number };
const FEED_TYPES = new Set(['rss', 'hacker-news', 'lobsters', 'reddit']);

/**
 * Per-type height estimate — the SINGLE source of truth for tile heights,
 * fed by the co-located widget PREFs. Feed lists with a declared limit > 5
 * are tall (3 rows); everything else uses its PREF row count; unknown types
 * are 1 row. Tiles, skeletons, and samples all flow through here.
 */
export function estRowsFor(type: string | undefined, limit?: number): number {
  const base = (PREFERRED_SIZES as Record<string, PrefRow>)[type ?? '']?.rows ?? 1;
  if (type && FEED_TYPES.has(type) && (limit ?? 0) > 5) return Math.max(3, base);
  return Math.max(1, base);
}

/** One column's height estimate: the sum of its widgets' estimates. */
export function columnEstRows(widgets: Array<{ type?: string; limit?: number }>): number {
  const total = widgets.reduce((sum, w) => sum + estRowsFor(w.type, w.limit), 0);
  return Math.min(Math.max(total, ROW_SPAN_MIN), ROW_SPAN_MAX);
}

export interface ColumnLike {
  span?: number;
  widgets: Array<{ type?: string; limit?: number }>;
}

/**
 * `place()` inputs for columns-mode pages (collage + skeleton share this).
 * Column spans are native 12-col units (explicit `span`, else size-derived
 * fallback, else 1), so they ride `cols` explicitly and bypass the legacy
 * 1-4 `span` mapping. Heights are summed per-widget estimates. Priority 0
 * keeps config order.
 */
export function columnPlaceInputs(columns: ColumnLike[], fallbackSpans?: number[]): PlaceTileInput[] {
  return columns.map((col, i) => {
    const units = col.span ?? fallbackSpans?.[i] ?? 1;
    return {
      id: `column-${i}`,
      span: units,
      cols: units,
      rows: null,
      estRows: columnEstRows(col.widgets),
      priority: 0,
      zone: null,
    };
  });
}

export interface FlatWidgetLike {
  type?: string;
  span?: number;
  priority?: number;
  zone?: 'main' | 'sidebar';
  limit?: number;
}

type FlatPref = { cols: number | null; rows: number; priority: number; zone: 'main' | 'sidebar' };

/**
 * `place()` input for one flat-bento widget (live + skeleton share this):
 * explicit unit hints from the PREF registry, config overrides for
 * span/priority/zone, height estimate from the single table.
 */
export function flatPlaceInput(id: string, cfg: FlatWidgetLike): PlaceTileInput {
  const pref = (PREFERRED_SIZES as Record<string, FlatPref>)[cfg.type ?? ''];
  return {
    id,
    span: cfg.span ?? pref?.cols ?? 1,
    cols: pref?.cols ?? null,
    rows: pref?.rows ?? null,
    estRows: estRowsFor(cfg.type, cfg.limit),
    priority: cfg.priority ?? pref?.priority ?? 5,
    zone: cfg.zone ?? pref?.zone ?? null,
  };
}

/** Whether a widget type stretches with content (resizable) or keeps its
 * placed row span. Shared by live bento items and their skeletons. */
export function tileResizable(type: string | undefined): boolean {
  return (PREFERRED_SIZES as Record<string, { resizable?: boolean }>)[type ?? '']?.resizable ?? true;
}

/**
 * The placer. Normalizes each tile to a w x h footprint (fluid widths from
 * span, heights from rows else estRows, single 1-8 clamp, all capped to the
 * track count), then packs priority-first into the densest free slot —
 * sidebar tiles from the right, everything else from the left. CSS dense
 * flow backfills the rest; explicit x/y is consumed by flat bento.
 */
export function place(
  tiles: PlaceTileInput[],
  width: number,
  opts?: { rowUnit?: number; cols?: number },
): PlacedPage {
  const rowUnit = opts?.rowUnit ?? ROW_UNIT;
  const cols = Math.max(1, Math.min(opts?.cols ?? DESKTOP_COLS, trackCountForWidth(width)));
  const footprints = tiles.map((t) => ({
    id: t.id,
    priority: t.priority,
    zone: t.zone,
    w: Math.max(1, Math.min(t.cols ?? spanToUnits(t.span), cols)),
    h: Math.min(Math.max(t.rows ?? t.estRows, ROW_SPAN_MIN), ROW_SPAN_MAX),
  }));
  // Stable priority order: toSorted keeps config order within equal priority.
  const ordered = footprints.toSorted((a, b) => b.priority - a.priority);
  const occ: boolean[][] = [];
  const ensureRows = (n: number): void => {
    while (occ.length < n) occ.push(Array(cols).fill(false));
  };
  const canPlace = (x: number, y: number, w: number, h: number): boolean => {
    if (x + w > cols) return false;
    ensureRows(y + h);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (occ[y + dy][x + dx]) return false;
    return true;
  };
  const fill = (x: number, y: number, w: number, h: number): void => {
    ensureRows(y + h);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occ[y + dy][x + dx] = true;
  };
  const byId = new Map<string, PlacedTile>();
  // Row bound guarantees termination: every tile fits strictly below it.
  const maxRow = tiles.length * ROW_SPAN_MAX + 1;
  for (const t of ordered) {
    const starts: number[] = [];
    for (let x = 0; x <= cols - t.w; x++) starts.push(x);
    if (t.zone === 'sidebar') starts.reverse();
    let done = false;
    for (let y = 0; y <= maxRow && !done; y++) {
      for (const x of starts) {
        if (!canPlace(x, y, t.w, t.h)) continue;
        fill(x, y, t.w, t.h);
        byId.set(t.id, { id: t.id, col: x, row: y, w: t.w, h: t.h });
        done = true;
        break;
      }
    }
    if (!done) byId.set(t.id, { id: t.id, col: 0, row: occ.length, w: t.w, h: t.h });
  }
  return { cols, rowUnit, tiles: tiles.map((t) => byId.get(t.id)!) };
}

/**
 * Deep module for page tiling.
 *
 * Seam: tiling string (+ optional min width) -> container props. Callers
 * never touch grid internals. Geometry (spans, tracks, row unit) lives in
 * `place()`; this only picks the CSS mode class.
 */
export type Tiling = 'columns' | 'auto' | 'collage';

export function getTilingProps(
  tiling: string | undefined,
  minColumnWidth?: number,
): { className: string; style?: CSSProperties } {
  if (tiling === 'collage') {
    // Tracks/rows come from place() inline at render; the class only picks
    // the dense fixed-row-unit grid. No min-column-width: collage tracks are
    // explicit, not auto-fit.
    return { className: `${styles.columns} ${styles.collageTiling}` };
  }
  if (tiling === 'auto') {
    const width = minColumnWidth ?? MIN_COLUMN_WIDTH_DEFAULT;
    return {
      className: `${styles.columns} ${styles.autoTiling}`,
      style: { '--min-column-width': `${width}px` } as CSSProperties,
    };
  }
  return { className: styles.columns };
}
