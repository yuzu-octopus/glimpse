import type { CSSProperties } from 'react';
import styles from './page.module.css';

/** Grid cap for collage/auto chooser — not PageSchema columns (max 3) but CSS grid tracks; 6 allows a 300px min to fill 1920px wide pages. */
export const MAX_TILING_COLS = 6;

export type TilePref = {
  prefW: number | null;
  prefH: number | null;
  span: number;
  resizable: boolean;
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

function aspectMatch(tile: BentoTile, w: number, h: number, colW: number, rowUnit: number): number {
  if (tile.prefW == null && tile.prefH == null) return 1;
  const prefRatio = (tile.prefW ?? colW) / (tile.prefH ?? rowUnit);
  const rendered = (w * colW) / (h * rowUnit);
  const err = Math.abs(Math.log(rendered / prefRatio));
  return Math.exp(-err * 2);
}

function posWeight(x: number, y: number, zone?: string): number {
  // main favors top-left, sidebar favors top-right
  if (zone === 'sidebar') return 1 / (1 + 0.15 * (5 - x) + 0.25 * y);
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
  fragmentation(): number {
    let holes = 0;
    for (let y = 0; y < this.occ.length; y++) for (let x = 0; x < this.cols; x++) if (!this.occ[y][x]) {
      // hole with occupied below
      if (y + 1 < this.occ.length && this.occ[y + 1][x]) holes++;
    }
    return holes;
  }
}

const CANDIDATES: Array<{ w: number; h: number }> = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 1, h: 2 },
  { w: 2, h: 2 },
];

export function composeBento(tiles: BentoTile[], cols: number, opts?: { rowUnit?: number }): BentoPlacement[] {
  const rowUnit = opts?.rowUnit ?? 96;
  const colW = 300;
  const ordered = tiles.toSorted((a, b) => b.priority - a.priority);
  const grid = new BentoGrid(cols);
  const out: BentoPlacement[] = [];
  for (const tile of ordered) {
    const span = Math.min(tile.span || 1, cols);
    const shapes = CANDIDATES.filter((s) => s.w === span || (span === 1 && s.w <= 1) || (span > 1 && s.w === span)).length
      ? CANDIDATES.filter((s) => s.w === span)
      : [{ w: span, h: 1 }];
    // resizable false with tall pref prefers h=2
    const tall = !tile.resizable && tile.prefH != null && tile.prefH > rowUnit * 1.5;
    const candShapes = tall ? shapes.filter((s) => s.h === 2).length ? shapes.filter((s) => s.h === 2) : shapes : shapes.filter((s) => s.h === 1);
    const shapesToTry = candShapes.length ? candShapes : shapes;
    let best: { x: number; y: number; w: number; h: number; score: number } | null = null;
    // search up to 20 rows
    for (const sh of shapesToTry) {
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x <= cols - sh.w; x++) {
          if (!grid.canPlace(x, y, sh.w, sh.h)) continue;
          const ratio = aspectMatch(tile, sh.w, sh.h, colW, rowUnit);
          const pw = posWeight(x, y, tile.zone);
          const score = 2 * ratio + 2 * tile.priority * pw - 0.1 * grid.fragmentation();
          if (!best || score > best.score) best = { x, y, w: sh.w, h: sh.h, score };
        }
      }
    }
    if (best) {
      grid.place(best.x, best.y, best.w, best.h);
      out.push({ id: tile.id, x: best.x, y: best.y, w: best.w, h: best.h });
    }
  }
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
