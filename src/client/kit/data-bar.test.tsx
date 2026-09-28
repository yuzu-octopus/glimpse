import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataBar } from './data-bar';

const here = dirname(fileURLToPath(import.meta.url));

const used = (value: number) => ({
  id: 'used',
  value,
  color: 'var(--color-data-categorical-cyan)' as const,
});

const widthsOf = (bar: HTMLElement) =>
  [...bar.children].map(child => parseFloat((child as HTMLElement).style.flexBasis));

/**
 * The vendored DataBar is what a quota/headroom/budget meter is supposed to
 * use instead of core's task-progress ProgressBar, so these pin the behaviour
 * the ai-quota widget (and the kit's own demo sites) depend on: the accessible
 * name, the composition of a whole, and the colour contract.
 */
describe('kit DataBar', () => {
  // A bar with no name is an unlabelled graphic, so `label` is required at the
  // type level; this pins that it lands as the accessible name.
  it('exposes the label as the graphic accessible name', () => {
    render(<DataBar label="Build minutes quota" segments={[used(62)]} />);
    expect(screen.getByRole('img', { name: 'Build minutes quota' })).toBeInTheDocument();
  });

  // The whole reason it is not a progress bar: segments are shares of a total,
  // not steps toward a finish. A lone segment is the entire bar; it must never
  // be scaled against some implicit 100.
  it('fills the bar from the segments given, not from an assumed domain', () => {
    const { rerender } = render(<DataBar label="quota" segments={[used(10)]} />);
    expect(widthsOf(screen.getByRole('img', { name: 'quota' }))).toEqual([100]);

    rerender(<DataBar label="quota" segments={[used(10), { id: 'rest', value: 90, color: 'var(--color-data-categorical-blue)' }]} />);
    expect(widthsOf(screen.getByRole('img', { name: 'quota' }))).toEqual([10, 90]);
  });

  // A negative is not a magnitude. Summing one in would inflate every other
  // segment's share and push the bar past its track.
  it('drops non-positive values instead of dividing by a poisoned total', () => {
    render(
      <DataBar
        label="quota"
        segments={[used(-40), used(40), { id: 'rest', value: 60, color: 'var(--color-data-categorical-blue)' }]}
      />,
    );
    const widths = widthsOf(screen.getByRole('img', { name: 'quota' }));
    expect(widths).toHaveLength(2);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  // A tiny non-zero value must stay visible, and the floors it needs are taken
  // out of the segments that can afford them — flooring each independently
  // overflowed the bar.
  it('floors a tiny share without overflowing the track', () => {
    render(
      <DataBar
        label="quota"
        segments={[
          { id: 'a', value: 0.1, color: 'var(--color-data-categorical-cyan)' },
          { id: 'b', value: 0.2, color: 'var(--color-data-categorical-cyan)' },
          { id: 'c', value: 0.3, color: 'var(--color-data-categorical-cyan)' },
          { id: 'd', value: 99.4, color: 'var(--color-data-categorical-blue)' },
        ]}
      />,
    );
    const widths = widthsOf(screen.getByRole('img', { name: 'quota' }));
    expect(widths.every(width => width >= 2)).toBe(true);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  // An untouched window draws nothing as segments, so the bar would otherwise
  // be an invisible gap in the row. It falls through to the neutral track.
  it('paints the neutral track when every segment is zero', () => {
    const { container } = render(<DataBar label="quota" segments={[used(0)]} />);
    const bar = screen.getByRole('img', { name: 'quota' });
    expect(bar.children).toHaveLength(0);
    expect(bar).toHaveStyle({ background: 'var(--color-progress-value)' });
    expect(container).toBeTruthy();
  });

  // The contract that makes the 56 --color-data-* tokens load-bearing: a mark
  // resolves to a data role token, never a raw --dracula-* primitive or a hex.
  it('paints segments from the token it was handed, verbatim', () => {
    render(
      <DataBar
        label="quota"
        segments={[
          { id: 'used', value: 62, color: 'var(--color-data-categorical-green)' },
          { id: 'rest', value: 38, color: 'var(--color-data-yellow-3)' },
        ]}
      />,
    );
    const bar = screen.getByRole('img', { name: 'quota' });
    expect((bar.children[0] as HTMLElement).style.background).toBe('var(--color-data-categorical-green)');
    expect((bar.children[1] as HTMLElement).style.background).toBe('var(--color-data-yellow-3)');
  });

  it('carries the re-sync note and the self-contained-import deviation', () => {
    const src = readFileSync(join(here, 'data-bar.tsx'), 'utf8');
    expect(src).toMatch(/^\/\/ Vendored from astryx-dracula@[\d.]+ `shared\/data-bar\.tsx` \(MIT\)/);
    expect(src).toMatch(/re-sync this file on any kit version bump/);
    // The package path would load a second CHART_HUES beside this repo's copy.
    expect(src).not.toMatch(/from 'astryx-dracula\//);
  });
});
