import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeatherData } from '../../../shared/widgets/payloads';
import { Weather } from './index';

// Fixed so the fixture is deterministic whatever zone the suite runs in: the
// payload declares `timezone: 'UTC'`, so its rows are UTC calendar days.
const TODAY = '2026-09-27';

const DATA: WeatherData = {
  location: 'London, England, United Kingdom',
  timezone: 'UTC',
  current: { temp: 23, feelsLike: 21, humidity: 60, code: 2 },
  daily: [
    { date: TODAY, code: 0, high: 25, low: 15 },
    { date: '2026-08-12', code: 61, high: 20, low: 12 },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('weather widget', () => {
  it('renders temperature, condition, feels-like, humidity and location', () => {
    render(<Weather config={{ type: 'weather', location: 'London' }} data={DATA} />);
    expect(screen.getByText('23°')).toBeInTheDocument();
    expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
    expect(screen.getByText('Feels like 21°C')).toBeInTheDocument();
    expect(screen.getByText('Humidity 60%')).toBeInTheDocument();
    expect(screen.getByText('London, England, United Kingdom')).toBeInTheDocument();
  });

  it('drops the humidity line when the provider reports none', () => {
    render(
      <Weather
        config={{ type: 'weather', location: 'London' }}
        data={{ ...DATA, current: { ...DATA.current, humidity: null } }}
      />,
    );
    expect(screen.queryByText(/Humidity/)).toBeNull();
  });

  it('renders daily rows for today and upcoming days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    render(<Weather config={{ type: 'weather', location: 'London' }} data={DATA} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('25°')).toBeInTheDocument();
    expect(screen.getByText('15°')).toBeInTheDocument();
  });

  // Open-meteo answers `timezone=auto`, so the rows are the *forecast
  // location's* calendar days. At 12:00Z on the 27th, Kiritimati (UTC+14) is
  // already on the 28th and Los Angeles (UTC-7) is still on the 27th, so a
  // "Today" asked in UTC or in the viewer's zone is wrong for one of them
  // every single day. This is the whole reason the payload carries a zone.
  it.each([
    // high = 20/21/22 identifies which row carries the label.
    ['Pacific/Kiritimati', '21°'],
    ['America/Los_Angeles', '20°'],
  ])('labels Today in the forecast zone %s, not in UTC', (timezone, todayHigh) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    render(
      <Weather
        config={{ type: 'weather', location: 'anywhere' }}
        data={{
          ...DATA,
          timezone,
          daily: [
            { date: '2026-09-27', code: 0, high: 20, low: 10 },
            { date: '2026-09-28', code: 0, high: 21, low: 11 },
            { date: '2026-09-29', code: 0, high: 22, low: 12 },
          ],
        }}
      />,
    );
    expect(screen.getAllByText('Today')).toHaveLength(1);
    expect(screen.getByText('Today').closest('div')).toHaveTextContent(todayHigh);
  });

  it('shows the empty state without data', () => {
    render(<Weather config={{ type: 'weather', location: 'London' }} data={null} isLoading={false} />);
    expect(screen.getByText('No weather data.')).toBeInTheDocument();
  });

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Weather config={{ type: 'weather', title: 'Weather', location: 'London' }} data={null} error="open-meteo unreachable" />,
    );
    expect(screen.getByText('open-meteo unreachable')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    expect(screen.queryByText('No weather data.')).toBeNull();
  });

  // An error arriving alongside a cached payload is a real state: the poll
  // failed but the last good forecast is still on screen, so `show-errors:
  // false` keeps the content and asks the StatusDot to do the reporting. The
  // weather chrome did not pass `error` at all here, so a stale forecast
  // looked exactly like a live one — the one widget in the app where a cached
  // payload could hide a dead feed.
  it('still reports a fetch error when a cached payload is on screen', () => {
    render(
      <Weather
        config={{ type: 'weather', title: 'Weather', location: 'London', 'show-errors': false }}
        data={DATA}
        error="open-meteo unreachable"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    // The last good forecast stays readable — quiet never means blank.
    expect(screen.getByText('23°')).toBeInTheDocument();
  });

  it.each([
    [71, 'cloud-snow'],   // snow
    [85, 'cloud-snow'],   // snow showers
    [82, 'cloud-rain'],   // rain showers
    [95, 'cloud-lightning'], // thunderstorm
  ])('maps WMO code %i to the %s icon', (code, icon) => {
    const { container } = render(
      <Weather
        config={{ type: 'weather', location: 'London' }}
        data={{ ...DATA, current: { ...DATA.current, code }, daily: [] }}
      />,
    );
    expect(container.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
  });
});
