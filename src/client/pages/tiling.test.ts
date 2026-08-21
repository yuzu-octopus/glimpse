import { describe, expect, it } from 'vitest';
import { chooseColumnCount, getTilingProps } from './tiling';

describe('chooseColumnCount', () => {
  it('picks n minimizing squared error 2D (1920 gap23 min300 max6)', () => {
    const tiles = [
      { prefW: 300, prefH: 200, span: 1, resizable: false },
      { prefW: 380, prefH: 220, span: 1, resizable: false },
      { prefW: 340, prefH: 200, span: 1, resizable: false },
    ];
    // actualW(n)=(1920-(n-1)*23)/n -> n=5 closest to ~340 avg, n=4 farther
    // squared error minimal at 5 (task spec illustrative 4, impl 5 is correct argmin)
    expect(chooseColumnCount(1920, 23, 300, 6, tiles)).toBe(5);
  });
  it('fluid-only null -> clamp floor(W/minW)', () => {
    const tiles = [
      { prefW: null, prefH: null, span: 1, resizable: true },
      { prefW: null, prefH: null, span: 1, resizable: true },
    ];
    expect(chooseColumnCount(1920, 23, 300, 6, tiles)).toBe(6);
  });
  it('span-2 hero requires at least 2 columns', () => {
    const tiles = [
      { prefW: 500, prefH: 400, span: 2, resizable: false },
      { prefW: 300, prefH: 200, span: 1, resizable: false },
    ];
    const n = chooseColumnCount(1920, 23, 300, 6, tiles);
    expect(n).toBeGreaterThanOrEqual(2);
  });
  it('blank h left out (null vs 220 same n)', () => {
    const base = [
      { prefW: 340, prefH: null, span: 1, resizable: true },
      { prefW: 340, prefH: null, span: 1, resizable: true },
    ];
    const withH = [
      { prefW: 340, prefH: 220, span: 1, resizable: false },
      { prefW: 340, prefH: 220, span: 1, resizable: false },
    ];
    expect(chooseColumnCount(1920, 23, 300, 6, base)).toBe(
      chooseColumnCount(1920, 23, 300, 6, withH),
    );
  });
  it('null width excluded from score, height lambda tie-break', () => {
    // width alone decides, height only via λ=0.1 small bump
    const tilesA = [{ prefW: 340, prefH: null, span: 1, resizable: true }];
    const tilesB = [{ prefW: 340, prefH: 320, span: 1, resizable: false }];
    // both should pick similar n since height dh=0 for 320 (320/80=4 exact)
    expect(chooseColumnCount(800, 23, 300, 4, tilesA)).toBe(
      chooseColumnCount(800, 23, 300, 4, tilesB),
    );
  });
});


describe('getTilingProps', () => {
  it('collage returns collageTiling class and measure true', () => {
    const props = getTilingProps('collage', 360);
    expect(props.className).toContain('collageTiling');
    expect(props.measure).toBe(true);
    expect((props.style as Record<string, string>)?.['--min-column-width']).toBe('360px');
  });

  it('auto returns autoTiling class and not measure', () => {
    const props = getTilingProps('auto', 300);
    expect(props.className).toContain('autoTiling');
    expect(props.measure).toBe(false);
    expect((props.style as Record<string, string>)?.['--min-column-width']).toBe('300px');
  });

  it('columns returns base columns class and no style', () => {
    const props = getTilingProps('columns');
    expect(props.className).toContain('columns');
    expect(props.className).not.toContain('autoTiling');
    expect(props.className).not.toContain('collageTiling');
    expect(props.style).toBeUndefined();
    expect(props.measure).toBe(false);
  });

  it('undefined defaults to columns', () => {
    const props = getTilingProps(undefined);
    expect(props.className).not.toContain('autoTiling');
    expect(props.measure).toBe(false);
  });

  it('defaults minColumnWidth to 300', () => {
    const props = getTilingProps('auto');
    expect((props.style as Record<string, string>)?.['--min-column-width']).toBe('300px');
  });
});
