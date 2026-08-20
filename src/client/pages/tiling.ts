import type { CSSProperties } from 'react';
import styles from './page.module.css';

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
