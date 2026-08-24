import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration, parseDuration } from '../../../shared/widgets/timer';
import { Timer } from './index';

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
});
