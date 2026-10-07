import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Clock } from './index';

// Independent offset computation (Date.getTimezoneOffset vs Intl longOffset)
// so the test verifies the rendered badge, not the implementation.
function localOffsetMin(now: Date): number {
  return -now.getTimezoneOffset();
}

function tzOffsetMin(tz: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function expectedBadge(tz: string, now: Date): { label: string; word: string } {
  const diff = tzOffsetMin(tz, now) - localOffsetMin(now);
  if (diff === 0) return { label: '0h', word: 'same' };
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const sign = diff > 0 ? '+' : '-';
  const label = mins === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${mins}m`;
  return { label, word: diff > 0 ? 'ahead' : 'behind' };
}

describe('clock widget', () => {
  it('renders the local time and date', () => {
    render(<Clock config={{ type: 'clock', timezones: [] }} data={null} />);
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('renders an offset badge vs local time for a timezone', () => {
    const now = new Date();
    const expected = expectedBadge('Asia/Kolkata', now);
    render(
      <Clock
        config={{ type: 'clock', timezones: [{ timezone: 'Asia/Kolkata' }] }}
        data={null}
      />,
    );
    const badge = screen.getByTitle(new RegExp(expected.word, 'i'));
    expect(badge).toHaveTextContent(expected.label);
  });

  it('shows the zone time alongside the offset', () => {
    render(
      <Clock
        config={{ type: 'clock', timezones: [{ timezone: 'UTC', label: 'Coordinated' }] }}
        data={null}
      />,
    );
    expect(screen.getByText('Coordinated')).toBeInTheDocument();
    expect(screen.getAllByText(/\d{2}:\d{2}/).length).toBeGreaterThan(0);
  });

  it('renders different times for different timezones', () => {
    render(
      <Clock
        config={{
          type: 'clock',
          timezones: [
            { timezone: 'UTC', label: 'UTC' },
            { timezone: 'Asia/Tokyo', label: 'Tokyo' },
          ],
        }}
        data={null}
      />,
    );
    // Both zones should show a time
    const times = screen.getAllByText(/\d{2}:\d{2}/);
    expect(times.length).toBeGreaterThanOrEqual(3); // local + UTC + Tokyo
  });

  it('renders 12h format when hour-format is 12h', () => {
    render(
      <Clock
        config={{ type: 'clock', 'hour-format': '12h', timezones: [] }}
        data={null}
      />,
    );
    // 12h format includes AM/PM
    expect(screen.getByText(/\d{2}:\d{2} (AM|PM)/i)).toBeInTheDocument();
  });

  it('renders 24h format by default', () => {
    render(<Clock config={{ type: 'clock', timezones: [] }} data={null} />);
    // 24h format: no AM/PM
    expect(screen.queryByText(/AM|PM/i)).toBeNull();
  });

  it('renders the date in en-GB format', () => {
    render(<Clock config={{ type: 'clock', timezones: [] }} data={null} />);
    // en-GB weekday + day + month ("Wednesday 7 October", no year): the date
    // div holds the whole string, so match on the element's full textContent.
    expect(
      screen.getByText(
        (_, el) => el?.textContent != null && /^[A-Za-z]+ \d{1,2} [A-Za-z]+$/.test(el.textContent),
      ),
    ).toBeInTheDocument();
  });

  it('handles multiple timezones with labels', () => {
    render(
      <Clock
        config={{
          type: 'clock',
          timezones: [
            { timezone: 'America/New_York', label: 'New York' },
            { timezone: 'Europe/London', label: 'London' },
            { timezone: 'Asia/Kolkata', label: 'Mumbai' },
          ],
        }}
        data={null}
      />,
    );
    expect(screen.getByText('New York')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('Mumbai')).toBeInTheDocument();
  });

  it('shows timezone name when no label is provided', () => {
    render(
      <Clock
        config={{ type: 'clock', timezones: [{ timezone: 'Asia/Kolkata' }] }}
        data={null}
      />,
    );
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();
  });

  it('renders no separator when no timezones are configured', () => {
    const { container } = render(
      <Clock config={{ type: 'clock', timezones: [] }} data={null} />,
    );
    expect(container.querySelector('[class*="separator"]')).toBeNull();
  });
});
