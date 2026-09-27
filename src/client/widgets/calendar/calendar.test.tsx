import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Calendar from './index';
import styles from './calendar.module.css';

// Aug 2026: the 1st is a Saturday (2026-08-11 is a Tuesday).
const AUG_2026 = new Date(2026, 7, 11);

// Only the Date clock is faked. userEvent needs real timers to resolve its
// internal waits, and nothing here depends on wall-clock time passing.
const freeze = (at: Date) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
};

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

const dayCells = () => Array.from(document.querySelectorAll<HTMLElement>(`.${styles.day}`));

/** The month heading, e.g. "August 2026". */
const monthLabel = () => screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent ?? '';

const prev = () => screen.getByRole('button', { name: 'Previous month' });
const next = () => screen.getByRole('button', { name: 'Next month' });
const home = () => screen.getByRole('button', { name: 'Back to current month' });

describe('calendar widget', () => {
  it('starts the week on monday by default', () => {
    freeze(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', title: 'Calendar' }} />);
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(dowLabels().slice(0, 3)).toEqual(['Mo', 'Tu', 'We']);
    // Saturday the 1st lands in the 6th column (index 5)
    expect(dayOneColumn()).toBe(5);
    expect(dowLabels()).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });

  it('starts the week on sunday when configured', () => {
    freeze(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', 'first-day-of-week': 'sunday' }} />);
    expect(dowLabels()).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    // Saturday the 1st is the last column (index 6)
    expect(dayOneColumn()).toBe(6);
  });

  it('starts the week on wednesday when configured', () => {
    freeze(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar', 'first-day-of-week': 'wednesday' }} />);
    expect(dowLabels()).toEqual(['We', 'Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu']);
    // Saturday the 1st is the 4th column (index 3)
    expect(dayOneColumn()).toBe(3);
  });

  it('highlights today', () => {
    freeze(AUG_2026);
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    const today = dayCells().find((el) => el.classList.contains(styles.today));
    expect(today?.textContent).toBe('11');
    expect(today?.getAttribute('aria-current')).toBe('date');
  });

  it('always renders six weeks of cells so scrubbing cannot reflow it', () => {
    // Feb 2021 starts on a Monday and has exactly 28 days — the shortest month.
    freeze(new Date(2021, 1, 15));
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    expect(dayCells()).toHaveLength(42);
  });
});

describe('calendar month scrub', () => {
  beforeEach(() => {
    freeze(AUG_2026);
  });

  it('opens on the current month with the forward step disabled', () => {
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    expect(monthLabel()).toBe('August 2026');
    expect(prev()).toBeEnabled();
    expect(next()).toBeDisabled();
  });

  it('steps back a month and re-enables the forward step', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    await user.click(prev());
    expect(monthLabel()).toBe('July 2026');
    expect(next()).toBeEnabled();
  });
  it('crosses the year boundary in both directions', async () => {
    freeze(new Date(2026, 0, 15));
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    await user.click(prev());
    expect(monthLabel()).toBe('December 2025');
    await user.click(next());
    expect(monthLabel()).toBe('January 2026');
  });

  it('stops at the current month instead of running into the future', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    // Three months back, then walk forward as far as the widget allows.
    for (let i = 0; i < 3; i++) await user.click(prev());
    expect(monthLabel()).toBe('May 2026');
    for (let i = 0; i < 10; i++) await user.click(next());
    expect(monthLabel()).toBe('August 2026');
    expect(next()).toBeDisabled();
  });
  it('stops at the current month when today is the first of the month', async () => {
    freeze(new Date(2026, 7, 1));
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    for (let i = 0; i < 5; i++) await user.click(next());
    expect(monthLabel()).toBe('August 2026');
  });

  it('offers a way home only while scrubbed away from the current month', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    expect(screen.queryByRole('button', { name: 'Back to current month' })).toBeNull();
    await user.click(prev());
    expect(home()).toBeInTheDocument();
    await user.click(home());
    expect(monthLabel()).toBe('August 2026');
    expect(screen.queryByRole('button', { name: 'Back to current month' })).toBeNull();
  });

  it('drops the today highlight in every other month', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    // Today is the 11th; July 2026 also has an 11th, which must not inherit it.
    await user.click(prev());
    expect(document.querySelectorAll(`.${styles.today}`)).toHaveLength(0);
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
    await user.click(home());
    expect(document.querySelectorAll(`.${styles.today}`)).toHaveLength(1);
  });

  it('renders the right day numbers for a scrubbed month', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    await user.click(prev());
    // July 2026 has 31 days, followed by next-month spillover.
    const current = dayCells().filter((el) => !el.classList.contains(styles.other));
    expect(current).toHaveLength(31);
    expect(current.at(-1)?.textContent).toBe('31');
  });

  it('scrubs from the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<Calendar data={null} config={{ type: 'calendar' }} />);
    prev().focus();
    await user.keyboard('{Enter}');
    expect(monthLabel()).toBe('July 2026');
    next().focus();
    await user.keyboard(' ');
    expect(monthLabel()).toBe('August 2026');
  });
});
