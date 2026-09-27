import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Network from './index';
import styles from './network.module.css';
import type { NetworkData } from '../../../shared/widgets/payloads';

/** A LAN link: the ping never moves, which is the case the buffer must chart. */
const STEADY: NetworkData = { localIp: '10.0.0.4', publicIp: '203.0.113.7', pingMs: 1 };

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`.${styles.bar}`));
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
  it('charts a steady ping as a flat sparkline', () => {
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
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, pingMs: 40 }} />);
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

  it('appends nothing while there is no reading to chart', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <Network config={{ type: 'network' }} data={STEADY} />,
    );
    sample(3);
    expect(bars(container).length).toBe(3);
    rerender(<Network config={{ type: 'network' }} data={{ ...STEADY, pingMs: null }} />);
    sample(3);
    // A failed ping is not a reading: the series holds rather than repeating
    // the last good value as if it were a fresh one.
    expect(bars(container).length).toBe(3);
  });
});
