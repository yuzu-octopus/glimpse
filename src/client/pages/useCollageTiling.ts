import { useEffect, type RefObject } from 'react';

/**
 * tiling: collage — measure pass. Reads each direct tile child's content
 * height, sets `--tile-row` to the shortest tile (the row unit) on the
 * container, and `grid-row: span N` inline on every tile so footprints
 * follow content (bento packing). Isolated here per docs/tiling-design.md
 * v2 §3 so a future `display: grid-lanes` swap is a CSS class change.
 *
 * Triggers one rAF-coalesced pass on mount, when `deps` change (data
 * hydration), and on container resize. The change guard (mirror of
 * glance's masonry.js `columnsCount === previousColumnsCount`) skips
 * identical passes so setting inline spans can't loop the ResizeObserver.
 */
export function useCollageTiling(
  containerRef: RefObject<HTMLElement | null>,
  deps: unknown[],
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return; // jsdom / no container: no-op
    const tiles = Array.from(container.children) as HTMLElement[];
    if (tiles.length === 0) return;

    let rafId: number | undefined;
    let observer: ResizeObserver | undefined;
    let prevKey = '';

    const measure = () => {
      const heights = tiles.map(
        (t) => Math.max(t.scrollHeight, t.clientHeight, 0) || 0,
      );
      const rowUnit = Math.min(...heights);
      if (!(rowUnit > 0)) return; // no measurable layout (jsdom): no-op
      const spans = heights.map((h) =>
        Math.min(Math.max(Math.round(h / rowUnit), 1), 4),
      );
      const key = spans.join(',');
      if (key === prevKey) return; // change guard: skip identical passes
      prevKey = key;
      container.style.setProperty('--tile-row', `${rowUnit}px`);
      tiles.forEach((tile, i) => {
        tile.style.gridRow = `span ${spans[i]}`;
        tile.dataset.rowSpan = String(spans[i]);
      });
    };

    const schedule = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(measure);
      } else {
        // jsdom has no rAF: run once synchronously (measure no-ops on zero
        // layout, so this is a safe fallback outside real browsers).
        measure();
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(container);
    }
    schedule();

    return () => {
      if (rafId !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, ...deps]);
}
