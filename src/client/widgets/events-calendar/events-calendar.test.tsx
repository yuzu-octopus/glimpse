import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventsCalendar from './index';

// Mon 2026-08-24 12:00 local — Today/Tomorrow labels deterministic.
const NOW = new Date(2026, 7, 24, 12, 0, 0);

// Sorted by start, exactly as the server fetcher returns them.
const EVENTS = [
  { title: 'Standup', startISO: new Date(2026, 7, 24, 14).toISOString(), endISO: new Date(2026, 7, 24, 14, 30).toISOString(), location: 'Room 4', allDay: false },
  { title: 'Retro', startISO: new Date(2026, 7, 24, 16).toISOString(), endISO: new Date(2026, 7, 24, 17).toISOString(), allDay: false },
  { title: 'Deploy review', startISO: new Date(2026, 7, 25, 9).toISOString(), endISO: new Date(2026, 7, 25, 10).toISOString(), allDay: false },
  { title: 'Conference', startISO: new Date(2026, 7, 28).toISOString(), allDay: true },
];

afterEach(() => {
  vi.useRealTimers();
});

describe('events-calendar widget', () => {
  it('groups events under Today/Tomorrow/date headers with time range and location', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    render(
      <EventsCalendar config={{ type: 'events-calendar' }} data={{ events: EVENTS }} />,
    );
    // Same-day events share one header; later days get Today/Tomorrow/Fri 28.
    const todayGroup = screen.getByRole('group', { name: 'Today' });
    expect(todayGroup.textContent).toContain('Standup');
    expect(todayGroup.textContent).toContain('Retro');
    expect(screen.getByRole('group', { name: 'Tomorrow' }).textContent).toContain('Deploy review');
    expect(screen.getByRole('group', { name: 'Fri 28' }).textContent).toContain('Conference');
    expect(screen.getByText('Room 4')).toBeInTheDocument();
    expect(screen.getByText('All day')).toBeInTheDocument();
  });

  it('renders an empty state with no upcoming events', () => {
    render(<EventsCalendar config={{ type: 'events-calendar' }} data={{ events: [] }} />);
    expect(screen.getByText('No upcoming events')).toBeInTheDocument();
  });
});
