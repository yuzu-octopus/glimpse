import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Network from './index';
import styles from './network.module.css';
import type { NetworkData } from '../../../shared/widgets/payloads';

/** A LAN link: the reading never moves, which is the case the buffer must chart. */
const STEADY: NetworkData = { localIp: '10.0.0.4', publicIp: '203.0.113.7', ttfbMs: 1 };

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`.${styles.bar}`));
}

/** A slot the sampler advanced through with no reading to record. */
function gaps(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`.${styles.gap}`));
}

function sample(times: number): void {
  act(() => {
    vi.advanceTimersByTime(30_000 * times);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('network widget', () => {
  it('charts a steady reading as a flat sparkline', () => {
    vi.useFakeTimers();
    const { container } = render(<Network config={{ type: 'network' }} data={STEADY} />);
    expect(bars(container).length).toBe(0);
    sample(1);
    sample(1);
    sample(1);
    const drawn = bars(container);
    expect(drawn.length).toBe(3);
    // Same value three times: one flat line, not a spike or a gap.
    expect(new Set(drawn.map((b) => b.style.height)).size).toBe(1);
  });

  it('starts a new series when the card measures a different target', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Network config={{ type: 'network' }} data={STEADY} />,
    );
    sample(3);
    expect(bars(container).length).toBe(3);
    rerender(<Network config={{ type: 'network', 'ping-target': '9.9.9.9' }} data={STEADY} />);
    expect(bars(container).length).toBe(0);
    // One sample is a bar of unknown scale, so the line only draws from the
    // second — which now belongs to the new card alone.
    sample(1);
    sample(1);
    expect(bars(container).length).toBe(2);
  });

  it('charts the newest reading, not the one it mounted with', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Network config={{ type: 'network' }} data={STEADY} />,
    );
    sample(1);
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, ttfbMs: 40 }} />);
    sample(1);
    const [short, tall] = bars(container);
    expect(Number.parseInt(short.style.height, 10)).toBeLessThan(
      Number.parseInt(tall.style.height, 10),
    );
  });

  it('holds a bounded window', () => {
    vi.useFakeTimers();
    const { container } = render(<Network config={{ type: 'network' }} data={STEADY} />);
    sample(30);
    expect(bars(container).length).toBe(20);
  });

  it('advances the window on a dropped sample instead of skipping it', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Network config={{ type: 'network' }} data={STEADY} />,
    );
    sample(3);
    expect(bars(container).length).toBe(3);
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, ttfbMs: null }} />);
    sample(3);
    // A failed probe is still 30 seconds that passed. Skipping it would let a
    // 3-hour outage chart as a tidy 10 minutes of the samples that survived,
    // so the window advances and the hole shows in its place.
    expect(gaps(container).length).toBe(3);
    expect(bars(container).length).toBe(3);
    // Twenty slots, not twenty-three: the cap is on the window, and the
    // holes are inside it.
    sample(30);
    expect(bars(container).length + gaps(container).length).toBe(20);
  });

  it('scales bars against the readings it has, ignoring holes', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Network config={{ type: 'network' }} data={{ ...STEADY, ttfbMs: 40 }} />,
    );
    sample(1);
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, ttfbMs: null }} />);
    sample(1);
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, ttfbMs: 40 }} />);
    sample(1);
    expect(gaps(container).length).toBe(1);
    // A hole is not a value: it must not drag the series max toward zero and
    // squash the real bars.
    const [before, after] = bars(container);
    expect(before.style.height).toBe(after.style.height);
  });

  it('labels the reading for what it measures, not for what it is not', () => {
    render(<Network config={{ type: 'network' }} data={STEADY} />);
    // `expect(getByText('TTFB')).toBeTruthy()` was dead — getByText throws when
    // absent — and `expect(() => getByText('Ping')).toThrow()` is a
    // throw-assert rather than an absence assert.
    expect(screen.getByText('TTFB')).toBeInTheDocument();
    expect(screen.queryByText('Ping')).toBeNull();
  });
});
