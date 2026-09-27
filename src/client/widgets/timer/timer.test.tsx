import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDuration, parseDuration } from '../../../shared/widgets/timer';
import { CHART_HUES } from '../../kit/chart-hues';
import { Timer } from './index';
import styles from './timer.module.css';

// Vitest serves CSS modules as a class-name proxy, so the token bindings are
// only observable in the stylesheet source itself.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'timer.module.css'), 'utf8');

function renderTimer(config: Record<string, unknown> = {}) {
  return render(
    <Timer
      config={{ type: 'timer', id: `timer-test-${Math.random().toString(36).slice(2)}`, ...config } as Record<string, unknown>}
      data={null}
    />,
  );
}

describe('parseDuration', () => {
  it('parses mm:ss', () => expect(parseDuration('25:00')).toBe(1500));
  it('parses hh:mm:ss', () => expect(parseDuration('1:05:30')).toBe(3930));
  it('parses 25m', () => expect(parseDuration('25m')).toBe(1500));
  it('parses 90s', () => expect(parseDuration('90s')).toBe(90));
  it('parses 1h30m', () => expect(parseDuration('1h30m')).toBe(5400));
});

describe('formatDuration', () => {
  it('formats under an hour', () => expect(formatDuration(90)).toBe('1:30'));
  it('formats over an hour', () => expect(formatDuration(3930)).toBe('1:05:30'));
});

describe('timer widget', () => {
  beforeEach(() => localStorage.clear());

  it('renders the default duration and lets the user edit it inline', () => {
    renderTimer({ duration: '25m' });
    const ring = screen.getByTestId('timer-ring');
    fireEvent.click(ring);
    const input = screen.getByLabelText('Duration');
    fireEvent.change(input, { target: { value: '5:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('timer-display').textContent).toBe('5:00');
  });

  it('switches between timer and stopwatch tabs', () => {
    renderTimer();
    fireEvent.click(screen.getByRole('tab', { name: 'Stopwatch' }));
    expect(screen.getByTestId('timer-widget')).toHaveAttribute('data-mode', 'stopwatch');
    fireEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    expect(screen.getByTestId('timer-widget')).toHaveAttribute('data-mode', 'timer');
  });

  it('toggles start/pause and resets', async () => {
    vi.useFakeTimers();
    const { unmount } = renderTimer({ duration: '1:00' });
    act(() => {
      fireEvent.click(screen.getByTestId('timer-toggle'));
    });
    expect(screen.getByTestId('timer-toggle').textContent).toContain('Pause');
    act(() => {
      fireEvent.click(screen.getByTestId('timer-toggle'));
    });
    expect(screen.getByTestId('timer-toggle').textContent).toContain('Start');
    fireEvent.click(screen.getByTestId('timer-reset'));
    expect(screen.getByTestId('timer-display').textContent).toBe('1:00');
    unmount();
    vi.useRealTimers();
  });

  it('shows and persists notes when notes: true', () => {
    renderTimer({ notes: true });
    const textarea = screen.getByTestId('timer-notes');
    fireEvent.change(textarea, { target: { value: 'remember to ship' } });
    expect(screen.getByTestId('timer-notes')).toHaveValue('remember to ship');
  });

  it('ring track and arc carry the ring marks', () => {
    const { container } = renderTimer({ duration: '25m' });
    const circles = container.querySelectorAll('svg circle');
    expect(circles).toHaveLength(2);
    expect(circles[0]).toHaveClass(styles.ringTrack);
    expect(circles[1]).toHaveClass(styles.ringValue);
  });

  it('takes the ring ink from the kit CHART_HUES, never purple', () => {
    const { container } = renderTimer({ duration: '25m' });
    const ring = screen.getByTestId('timer-ring');
    expect(ring).toHaveStyle({ '--ring-hue': CHART_HUES.cyan });
    const rule = (selector: string) => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('\\.ringValue')).toContain('stroke: var(--ring-hue)');
    expect(rule('\\.ringTrack')).toContain('var(--ring-hue) 10%');
    // purple means tappable, so it must never encode data
    expect(css).not.toContain('purple');
    expect(container.querySelector('svg')).not.toBeNull();
    // no entrance choreography
    expect(css).not.toContain('animation');
  });

  it('counts down at wall-clock rate, not faster', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      renderTimer({ duration: '25m' });
      fireEvent.click(screen.getByTestId('timer-toggle'));
      expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00');
      // 250ms of ticks, then 10s of wall clock: a tick that re-charges
      // cumulative elapsed every pass drains ~290s instead of 10s.
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('24:50');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never renders a loading skeleton — the timer is config-only and has nothing to fetch', () => {
    // PageView derives `isLoading` from `data == null && !error`, and a
    // config-only widget's payload is permanently `data: null`. A renderer
    // that forwards that flag shows a skeleton forever.
    render(
      <Timer
        config={{ type: 'timer', id: 'timer-loading-probe' } as Record<string, unknown>}
        data={null}
        isLoading
      />,
    );
    expect(screen.queryByTestId('widget-loading')).toBeNull();
    expect(screen.getByTestId('timer-display')).toHaveTextContent('25:00');
  });
});
