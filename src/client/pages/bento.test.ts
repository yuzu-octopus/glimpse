import { describe, expect, it } from 'vitest';
import { chooseColumnCount, composeBento, MAX_TILING_COLS, type BentoTile, type BentoPlacement } from './tiling';

const colHeights = (placements: BentoPlacement[], cols: number): number[] => {
  const hs = Array<number>(cols).fill(0);
  for (const p of placements) for (let dx = 0; dx < p.w; dx++) hs[p.x + dx] = Math.max(hs[p.x + dx], p.y + p.h);
  return hs;
};

describe('bento compositor', () => {
  it('composes on a 12-col underlying grid', () => {
    expect(MAX_TILING_COLS).toBe(12);
  });

  it('picks n* minimizing Σ error², blank null left out, λ tie-break', () => {
    const tiles = [
      { prefW: 340, prefH: 280, span: 1, resizable: false },
      { prefW: null, prefH: null, span: 1, resizable: true },
    ];
    // n=3: effW≈384.7 err≈1995 beats n=2 (effW 588.5, err 61752) and n=4 (effW 282.8, err 3277)
    expect(chooseColumnCount(1200, 23, 340, 6, tiles)).toBe(3);
  });

  it('blank (all-null) tiles leave the score untouched', () => {
    const blank = [{ prefW: null, prefH: null, span: 1, resizable: true }];
    expect(chooseColumnCount(1200, 23, 340, 6, blank)).toBe(chooseColumnCount(1200, 23, 340, 6, []));
  });

  it('bento balances column heights', () => {
    const sixTiles: BentoTile[] = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      priority: 5,
      span: 1,
      cols: 2,
      rows: 1,
      resizable: false,
    }));
    const placements = composeBento(sixTiles, 6);
    expect(placements).toHaveLength(6);
    const hs = colHeights(placements, 6);
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThanOrEqual(2);
  });

  it('variance repair fires when greedy leaves maxH-minH>1', () => {
    // greedy alone ends [3,2,1,1] (spread 2); repair must move the dangling tile
    const tiles: BentoTile[] = [
      { id: 'hero', priority: 10, span: 2, cols: 2, rows: 2, resizable: false },
      { id: 'a', priority: 9, span: 1, cols: 1, rows: 1, resizable: false },
      { id: 'b', priority: 8, span: 1, cols: 1, rows: 1, resizable: false },
      { id: 'c', priority: 7, span: 1, cols: 1, rows: 1, resizable: false },
    ];
    const placements = composeBento(tiles, 4);
    const hs = colHeights(placements, 4);
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThanOrEqual(1);
  });

  it('fluid tiles (cols null) take the widest fit', () => {
    const tiles: BentoTile[] = [
      { id: 'clock', priority: 9, span: 1, cols: 3, rows: 2, resizable: false, zone: 'sidebar' },
      { id: 'rss', priority: 8, span: 1, cols: null, rows: 2, resizable: true },
    ];
    const placements = composeBento(tiles, 12);
    const rss = placements.find((p) => p.id === 'rss');
    expect(rss?.w).toBeGreaterThanOrEqual(2);
  });
});
