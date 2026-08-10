import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Calendar from './index';
import styles from './calendar.module.css';

// Aug 2026: the 1st is a Saturday (2026-08-11 is a Tuesday).
const AUG_2026 = new Date(2026, 7, 11);

afterEach(() => {
  vi.useRealTimers();
});

function dowLabels(): string[] {
  return Array.from(document.querySelectorAll(`.${styles.dow}`)).map((el) => el.textContent ?? '');
}

/** Grid column (0-based) of the current-month day 1 cell. */
function dayOneColumn(): number {
  const cells = Array.from(document.querySelectorAll(`.${styles.day}`));
  return cells.findIndex((el) => !el.classList.contains(styles.other));
}

describe('calendar widget', () => {
  it('starts the week on monday by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', title: 'Calendar' }} />);
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(dowLabels().slice(0, 3)).toEqual(['Mo', 'Tu', 'We']);
    // Saturday the 1st lands in the 6th column (index 5)
    expect(dayOneColumn()).toBe(5);
    expect(dowLabels()).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });

  it('starts the week on sunday when configured', () => {
    vi.useFakeTimers();
    vi.setSystemTime(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', 'first-day-of-week': 'sunday' }} />);
    expect(dowLabels()).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    // Saturday the 1st is the last column (index 6)
    expect(dayOneColumn()).toBe(6);
  });

  it('starts the week on wednesday when configured', () => {
    vi.useFakeTimers();
    vi.setSystemTime(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', 'first-day-of-week': 'wednesday' }} />);
    expect(dowLabels()).toEqual(['We', 'Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu']);
    // Saturday the 1st is the 4th column (index 3)
    expect(dayOneColumn()).toBe(3);
  });

  it('highlights today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    const today = Array.from(document.querySelectorAll(`.${styles.day}`)).find((el) =>
      el.classList.contains(styles.today),
    );
    expect(today?.textContent).toBe('11');
  });
});
