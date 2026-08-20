import { describe, expect, it } from 'vitest';
import { getTilingProps } from './tiling';

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
