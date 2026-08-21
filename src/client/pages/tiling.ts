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
