import type { CSSProperties } from 'react';
import styles from './page.module.css';

/** Underlying bento grid cap — 12 columns on desktop per bento spec; the chooser clamps to container width via min-column-width. */
export const MAX_TILING_COLS = 12;

export type TilePref = {
  /** Preferred width/height in px — legacy collage chooser input; omitted on pure unit-based bento tiles. */
  prefW?: number | null;
  prefH?: number | null;
  span: number;
  resizable: boolean;
  /** Explicit bento width in grid columns (12-col units); null = fluid (widest fit). Absent = derived from span/prefW. */
  cols?: number | null;
  /** Explicit height in row units. Absent = derived from prefH. */
  rows?: number | null;
};

export function chooseColumnCount(
  W: number,
  gap: number,
  minW: number,
  maxCols: number,
  tiles: TilePref[],
  opts?: { rowUnit?: number; lambda?: number },
): number {
  const rowUnit = opts?.rowUnit ?? 80;
  const lambda = opts?.lambda ?? 0.1;
  const clampMax = Math.min(Math.max(Math.floor(W / minW) || 1, 1), maxCols);
  // fluid-only: no prefW and no non-resizable prefH -> fall back to clamp
  const hasPrefW = tiles.some((t) => t.prefW != null);
  const hasPrefH = tiles.some((t) => t.prefH != null && !t.resizable);
  if (!hasPrefW && !hasPrefH) return clampMax;
  let bestN = 1;
  let bestScore = Infinity;
  for (let n = 1; n <= maxCols; n++) {
    if (tiles.some((t) => t.span > n)) continue;
    const actualW = (W - (n - 1) * gap) / n;
    let score = 0;
    for (const t of tiles) {
      if (t.prefW != null) {
        const effW = t.span > 1 ? actualW * t.span + (t.span - 1) * gap : actualW;
        const dw = effW - t.prefW;
        score += dw * dw;
      }
      if (t.prefH != null && !t.resizable) {
        // height term is n-invariant (rowUnit fixed) — intentionally a λ-weighted tie-breaker
        // so width drives n* and height only nudges ties; keep λ small (0.1) for that reason
        const dh = Math.ceil(t.prefH / rowUnit) * rowUnit - t.prefH;
        score += lambda * dh * dh;
      }
    }
    if (score < bestScore || (score === bestScore && n > bestN)) {
      bestScore = score;
      bestN = n;
    }
  }
  return Math.min(bestN, clampMax);
}

export interface BentoTile extends TilePref {
  id: string;
  priority: number;
  zone?: 'main' | 'sidebar';
}

export interface BentoPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Nominal column width in px used only for aspect scoring — real track size depends on the container. */
const NOMINAL_COL_W = 300;

/** How close a w×h placement is to the tile's preferred aspect: 1 = exact, decays as exp(-2|log ratio|). */
function aspectMatch(prefRatio: number, w: number, h: number, rowUnit: number): number {
  const rendered = (w * NOMINAL_COL_W) / (h * rowUnit);
  return Math.exp(-Math.abs(Math.log(rendered / prefRatio)) * 2);
}

/** Preferred aspect as a px ratio — from grid units when both are given, else from px prefs. */
function prefAspect(tile: BentoTile, rowUnit: number): number {
  if (tile.cols != null && tile.rows != null) return (tile.cols * NOMINAL_COL_W) / (tile.rows * rowUnit);
  return (tile.prefW ?? NOMINAL_COL_W) / (tile.prefH ?? rowUnit);
}

function posWeight(x: number, y: number, zone: string | undefined, cols: number): number {
  // main favors top-left, sidebar favors top-right
  if (zone === 'sidebar') return 1 / (1 + 0.15 * (cols - 1 - x) + 0.25 * y);
  return 1 / (1 + 0.15 * x + 0.25 * y);
}

class BentoGrid {
  cols: number;
  occ: boolean[][] = [[]];
  constructor(cols: number) {
    this.cols = cols;
  }
  ensureRows(n: number): void {
    while (this.occ.length < n) this.occ.push(Array(this.cols).fill(false));
  }
  canPlace(x: number, y: number, w: number, h: number): boolean {
    if (x + w > this.cols) return false;
    this.ensureRows(y + h);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.occ[y + dy][x + dx]) return false;
    return true;
  }
  place(x: number, y: number, w: number, h: number): void {
    this.ensureRows(y + h);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.occ[y + dy][x + dx] = true;
  }
  unplace(x: number, y: number, w: number, h: number): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.occ[y + dy][x + dx] = false;
  }
  fragmentation(): number {
    let holes = 0;
    for (let y = 0; y < this.occ.length; y++) for (let x = 0; x < this.cols; x++) if (!this.occ[y][x]) {
      // hole with occupied below
      if (y + 1 < this.occ.length && this.occ[y + 1][x]) holes++;
    }
    return holes;
  }
}


/**
 * Placement shapes for one tile. Candidates come straight from its unit hints:
 * width = cols (null → fluid widest fit, absent → span), height = rows (absent → prefH-derived).
 */
function candidateShapes(tile: BentoTile, cols: number, rowUnit: number): Array<{ w: number; h: number }> {
  const span = Math.min(Math.max(tile.span || 1, 1), cols);
  const widths = tile.cols === undefined ? [span] : tile.cols == null ? [cols] : [Math.min(tile.cols, cols)];
  const rows = tile.rows !== undefined ? tile.rows : tile.prefH != null ? Math.ceil(tile.prefH / rowUnit) : 1;
  const heights = [Math.max(1, rows ?? 1)];
  const shapes: Array<{ w: number; h: number }> = [];
  for (const w of widths) for (const h of heights) if (w >= 1 && w <= cols) shapes.push({ w, h });
  return shapes.length > 0 ? shapes : [{ w: 1, h: 1 }];
}

function columnHeights(grid: BentoGrid, cols: number): number[] {
  const hs = Array<number>(cols).fill(0);
  for (let y = 0; y < grid.occ.length; y++) for (let x = 0; x < cols; x++) if (grid.occ[y][x]) hs[x] = Math.max(hs[x], y + 1);
  return hs;
}

/**
 * Variance repair: while the tallest column exceeds the shallowest by >1 row, move the overhang
 * tile into the shallowest column — unless the score drops ≥5%, then leave the layout alone.
 */
function repairVariance(
  grid: BentoGrid,
  out: BentoPlacement[],
  scores: Map<string, number>,
  byId: Map<string, BentoTile>,
  cols: number,
  rowUnit: number,
): void {
  const spread = () => {
    const hs = columnHeights(grid, cols);
    return Math.max(...hs) - Math.min(...hs);
  };
  for (let guard = out.length; guard > 0 && spread() > 1; guard--) {
    const hs = columnHeights(grid, cols);
    const deep = hs.indexOf(Math.max(...hs));
    const shallow = hs.indexOf(Math.min(...hs));
    if (deep === shallow) break;
    // the topmost-ending tile covering the deepest column pays for the overhang
    let victimIdx = -1;
    for (let i = 0; i < out.length; i++) {
      const p = out[i];
      if (p.x <= deep && deep < p.x + p.w && (victimIdx < 0 || p.y + p.h > out[victimIdx].y + out[victimIdx].h)) victimIdx = i;
    }
    const v = victimIdx < 0 ? null : out[victimIdx];
    const tile = v ? byId.get(v.id) : undefined;
    const oldScore = v ? scores.get(v.id) : undefined;
    if (!v || !tile || oldScore == null) break;
    grid.unplace(v.x, v.y, v.w, v.h);
    const nx = shallow;
    const ny = hs[shallow];
    if (grid.canPlace(nx, ny, v.w, v.h)) {
      const score =
        2 * aspectMatch(prefAspect(tile, rowUnit), v.w, v.h, rowUnit) +
        2 * tile.priority * posWeight(nx, ny, tile.zone, cols) -
        0.1 * grid.fragmentation();
      if (score >= oldScore * 0.95) {
        grid.place(nx, ny, v.w, v.h);
        out[victimIdx] = { id: v.id, x: nx, y: ny, w: v.w, h: v.h };
        scores.set(v.id, score);
        continue;
      }
    }
    grid.place(v.x, v.y, v.w, v.h); // no cheap move — restore and stop
    break;
  }
}

export function composeBento(tiles: BentoTile[], cols: number, opts?: { rowUnit?: number }): BentoPlacement[] {
  const rowUnit = opts?.rowUnit ?? 96;
  const ordered = tiles.toSorted((a, b) => b.priority - a.priority);
  const byId = new Map(ordered.map((t) => [t.id, t]));
  const grid = new BentoGrid(cols);
  const out: BentoPlacement[] = [];
  const scores = new Map<string, number>();
  for (const tile of ordered) {
    const prefRatio = prefAspect(tile, rowUnit);
    let best: { x: number; y: number; w: number; h: number; score: number } | null = null;
    for (const sh of candidateShapes(tile, cols, rowUnit)) {
      // search up to 20 rows down
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x <= cols - sh.w; x++) {
          if (!grid.canPlace(x, y, sh.w, sh.h)) continue;
          const score =
            2 * aspectMatch(prefRatio, sh.w, sh.h, rowUnit) +
            2 * tile.priority * posWeight(x, y, tile.zone, cols) -
            0.1 * grid.fragmentation();
          if (!best || score > best.score) best = { x, y, w: sh.w, h: sh.h, score };
        }
      }
    }
    if (best) {
      grid.place(best.x, best.y, best.w, best.h);
      out.push({ id: tile.id, x: best.x, y: best.y, w: best.w, h: best.h });
      scores.set(tile.id, best.score);
    }
  }
  repairVariance(grid, out, scores, byId, cols, rowUnit);
  return out;
}

/**
 * Deep module for page tiling.
 *
 * Seam: tiling string (+ optional min width) -> container props. Callers
 * never touch grid internals.
 *
 * Hidden inside page.module.css / this mapping:
 *  - `.page` flow-root + ::after spacer: keeps bottom padding from collapsing
 *    when the grid stretches (collage stretch cells).
 *  - align-content: start on both auto/collage grids: packs to top so
 *    var(--space-gap) bottom padding is the single footer gap.
 *  - span 1-4 (config `span`) + row-span 1-8 (collage measure/skeleton):
 *    CSS data-attr rules + inline grid-row span from useCollageTiling.
 *  - dense flow + auto-fit minmax(min(var(--min-column-width),100%),1fr).
 *  - container-type: inline-size on .columns / .collageTiling (query container).
 */
export type Tiling = 'columns' | 'auto' | 'collage';

export function getTilingProps(
  tiling: string | undefined,
  minColumnWidth?: number,
): { className: string; style?: CSSProperties; measure: boolean } {
  const width = minColumnWidth ?? 300;
  if (tiling === 'collage') {
    return {
      className: `${styles.columns} ${styles.collageTiling}`,
      style: { '--min-column-width': `${width}px` } as CSSProperties,
      measure: true,
    };
  }
  if (tiling === 'auto') {
    return {
      className: `${styles.columns} ${styles.autoTiling}`,
      style: { '--min-column-width': `${width}px` } as CSSProperties,
      measure: false,
    };
  }
  return { className: styles.columns, measure: false };
}
