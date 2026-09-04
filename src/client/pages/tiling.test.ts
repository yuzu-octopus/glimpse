import { describe, expect, it } from 'vitest';
import {
  DESKTOP_COLS,
  MOBILE_COLS,
  ROW_SPAN_MAX,
  ROW_UNIT,
  TABLET_COLS,
  columnEstRows,
  columnPlaceInputs,
  estRowsFor,
  flatPlaceInput,
  getTilingProps,
  place,
  spanToUnits,
  trackCountForWidth,
  type PlaceTileInput,
  type PlacedTile,
} from './tiling';

const tile = (overrides: Partial<PlaceTileInput> & { id: string }): PlaceTileInput => ({
  span: 1,
  cols: null,
  rows: null,
  estRows: 1,
  priority: 5,
  zone: null,
  ...overrides,
});

/** Fails on any overlapping footprint or out-of-grid tile. */
function expectPacked(tiles: PlacedTile[], cols: number): void {
  const occ = new Set<string>();
  for (const t of tiles) {
    expect(t.w).toBeGreaterThanOrEqual(1);
    expect(t.col + t.w).toBeLessThanOrEqual(cols);
    for (let dy = 0; dy < t.h; dy++)
      for (let dx = 0; dx < t.w; dx++) {
        const k = `${t.col + dx},${t.row + dy}`;
        expect(occ.has(k), `${t.id} overlaps at ${k}`).toBe(false);
        occ.add(k);
      }
  }
}

describe('trackCountForWidth', () => {
  it('is 12 / 6 / 1 at desktop / tablet / mobile widths', () => {
    expect(trackCountForWidth(1440)).toBe(DESKTOP_COLS);
    expect(trackCountForWidth(820)).toBe(TABLET_COLS);
    expect(trackCountForWidth(390)).toBe(MOBILE_COLS);
  });
  it('breaks at 600 and 900', () => {
    expect(trackCountForWidth(600)).toBe(1);
    expect(trackCountForWidth(601)).toBe(6);
    expect(trackCountForWidth(900)).toBe(6);
    expect(trackCountForWidth(901)).toBe(12);
  });
  it('falls back to desktop for unmeasurable widths', () => {
    expect(trackCountForWidth(0)).toBe(DESKTOP_COLS);
  });
});

describe('spanToUnits', () => {
  it('maps legacy 1-4 spans x3, keeps 12-col units native', () => {
    expect(spanToUnits(1)).toBe(3);
    expect(spanToUnits(2)).toBe(6);
    expect(spanToUnits(3)).toBe(9);
    expect(spanToUnits(4)).toBe(12);
    expect(spanToUnits(6)).toBe(6);
    expect(spanToUnits(8)).toBe(8);
    expect(spanToUnits(12)).toBe(12);
  });
});

describe('estRowsFor', () => {
  it('boosts long feed lists to 3 rows', () => {
    expect(estRowsFor('rss', 10)).toBe(3);
    expect(estRowsFor('hacker-news', 8)).toBe(3);
    expect(estRowsFor('lobsters', 8)).toBe(3);
    expect(estRowsFor('reddit', 8)).toBe(3);
  });
  it('reads the co-located PREF row count otherwise', () => {
    expect(estRowsFor('rss', 5)).toBe(3);
    expect(estRowsFor('videos')).toBe(2);
    expect(estRowsFor('calendar')).toBe(3);
    expect(estRowsFor('clock')).toBe(2);
    expect(estRowsFor('markets')).toBe(1);
    expect(estRowsFor('search')).toBe(1);
    expect(estRowsFor('group')).toBe(3);
    expect(estRowsFor('monitor')).toBe(2);
  });
  it('is 1 row for unknown types', () => {
    expect(estRowsFor('nope')).toBe(1);
    expect(estRowsFor(undefined)).toBe(1);
  });
});

describe('columnEstRows', () => {
  it('sums widget estimates', () => {
    expect(columnEstRows([{ type: 'rss', limit: 10 }, { type: 'markets' }])).toBe(4);
  });
  it('clamps to the single 1-8 span', () => {
    expect(columnEstRows([])).toBe(1);
    expect(
      columnEstRows([
        { type: 'videos' },
        { type: 'videos' },
        { type: 'videos' },
        { type: 'videos' },
        { type: 'videos' },
      ]),
    ).toBe(ROW_SPAN_MAX);
  });
});

describe('columnPlaceInputs', () => {
  it('keeps native 12-col spans (no x3 mapping)', () => {
    const inputs = columnPlaceInputs(
      [
        { span: 3, widgets: [{ type: 'clock' }] },
        { span: 6, widgets: [{ type: 'rss', limit: 10 }] },
        { span: 3, widgets: [{ type: 'todo' }] },
      ],
      undefined,
    );
    expect(inputs.map((t) => t.cols)).toEqual([3, 6, 3]);
  });
  it('falls back to size-derived spans, then 1', () => {
    const inputs = columnPlaceInputs([{ widgets: [{ type: 'clock' }] }], [9]);
    expect(inputs[0].cols).toBe(9);
    expect(columnPlaceInputs([{ widgets: [] }], undefined)[0].cols).toBe(1);
  });
});

describe('flatPlaceInput', () => {
  it('takes unit hints from the PREF registry with config overrides', () => {
    const t = flatPlaceInput('rss', { type: 'rss', limit: 10 });
    expect(t.cols).toBeNull();
    expect(t.rows).toBe(3);
    expect(t.estRows).toBe(3);
    expect(t.priority).toBe(10);
    const clock = flatPlaceInput('c', { type: 'clock', priority: 1, zone: 'main' });
    expect(clock.cols).toBe(3);
    expect(clock.priority).toBe(1);
    expect(clock.zone).toBe('main');
  });
});

describe('place', () => {
  it('keeps Home-style 3/6/3 footprints on desktop with summed heights', () => {
    const placed = place(
      columnPlaceInputs(
        [
          { span: 3, widgets: [{ type: 'clock' }] },
          { span: 6, widgets: [{ type: 'rss', limit: 10 }] },
          { span: 3, widgets: [{ type: 'todo' }] },
        ],
        undefined,
      ),
      1440,
    );
    expect(placed.cols).toBe(12);
    expect(placed.rowUnit).toBe(ROW_UNIT);
    expect(placed.tiles.map((t) => [t.w, t.h])).toEqual([
      [3, 2],
      [6, 3],
      [3, 2],
    ]);
    expectPacked(placed.tiles, placed.cols);
  });
  it('returns tiles in input order', () => {
    const placed = place([tile({ id: 'b' }), tile({ id: 'a' })], 1440);
    expect(placed.tiles.map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('packs priority-first: the hero takes the top-left', () => {
    const placed = place(
      [tile({ id: 'low', priority: 1, cols: 6, rows: 2 }), tile({ id: 'hero', priority: 9, cols: 6, rows: 2 })],
      1440,
    );
    expect(placed.tiles.find((t) => t.id === 'hero')).toMatchObject({ col: 0, row: 0 });
    expectPacked(placed.tiles, placed.cols);
  });
  it('biases sidebar tiles to the right, main tiles to the left', () => {
    const right = place([tile({ id: 's', cols: 3, rows: 1, zone: 'sidebar' })], 1440);
    expect(right.tiles[0].col).toBe(9);
    const left = place([tile({ id: 'm', cols: 3, rows: 1, zone: 'main' })], 1440);
    expect(left.tiles[0].col).toBe(0);
  });
  it('fluid tiles (cols null) take the span-mapped widest fit', () => {
    const placed = place([tile({ id: 'rss', span: 1, cols: null, rows: 2 })], 1440);
    expect(placed.tiles[0].w).toBe(3);
  });
  it('caps footprints to the track count on tablet and mobile', () => {
    const tablet = place([tile({ id: 'wide', span: 8, cols: 8, rows: 2 })], 820);
    expect(tablet.cols).toBe(6);
    expect(tablet.tiles[0].w).toBe(6);
    const mobile = place([tile({ id: 'wide', span: 8, cols: 8, rows: 2 })], 390);
    expect(mobile.cols).toBe(1);
    expect(mobile.tiles[0]).toMatchObject({ col: 0, w: 1 });
  });
  it('honors an explicit track override, still capped by breakpoint', () => {
    expect(place([tile({ id: 'a' })], 1440, { cols: 6 }).cols).toBe(6);
    expect(place([tile({ id: 'a' })], 820, { cols: 12 }).cols).toBe(6);
  });
  it('explicit rows win; heights clamp to the single 1-8 span', () => {
    const placed = place(
      [
        tile({ id: 'tall', estRows: 30 }),
        tile({ id: 'flat', rows: 0, estRows: 5 }),
        tile({ id: 'exact', rows: 4, estRows: 1 }),
      ],
      1440,
    );
    const h = (id: string) => placed.tiles.find((t) => t.id === id)!.h;
    expect(h('tall')).toBe(ROW_SPAN_MAX);
    expect(h('flat')).toBe(1);
    expect(h('exact')).toBe(4);
  });
  it('packs a balanced wall without overlaps', () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      tile({ id: `t${i}`, cols: 2, rows: 1, priority: 5 }),
    );
    const placed = place(six, 1440, { cols: 6 });
    expect(placed.tiles).toHaveLength(6);
    expectPacked(placed.tiles, placed.cols);
    // two full rows of three: dense and balanced
    const rows = placed.tiles.map((t) => t.row);
    expect(Math.max(...rows)).toBe(1);
  });
  it('respects a custom row unit', () => {
    expect(place([tile({ id: 'a' })], 1440, { rowUnit: 80 }).rowUnit).toBe(80);
  });
});

describe('getTilingProps', () => {
  it('collage returns the collage class with no measure flag or style', () => {
    const props = getTilingProps('collage', 360);
    expect(props.className).toContain('collageTiling');
    expect(props).not.toHaveProperty('measure');
    expect(props.style).toBeUndefined();
  });
  it('auto returns the auto class with the min-column-width var', () => {
    const props = getTilingProps('auto', 340);
    expect(props.className).toContain('autoTiling');
    expect((props.style as Record<string, string>)?.['--min-column-width']).toBe('340px');
  });
  it('columns and undefined return the base grid class', () => {
    for (const t of ['columns', undefined] as const) {
      const props = getTilingProps(t);
      expect(props.className).toContain('columns');
      expect(props.className).not.toContain('autoTiling');
      expect(props.className).not.toContain('collageTiling');
      expect(props.style).toBeUndefined();
    }
  });
  it('defaults minColumnWidth to 300', () => {
    const props = getTilingProps('auto');
    expect((props.style as Record<string, string>)?.['--min-column-width']).toBe('300px');
  });
});
