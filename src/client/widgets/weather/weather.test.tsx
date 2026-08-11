import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeatherData } from '../../../server/widgets/weather';
import { Weather } from './index';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATA: WeatherData = {
  location: 'London, England, United Kingdom',
  current: { temp: 23, feelsLike: 21, humidity: 60, code: 2 },
  daily: [
    { date: todayISO(), code: 0, high: 25, low: 15 },
    { date: '2026-08-12', code: 61, high: 20, low: 12 },
  ],
};

describe('weather widget', () => {
  it('renders temperature, condition, feels-like and location', () => {
    render(<Weather config={{ type: 'weather', location: 'London' }} data={DATA} />);
    expect(screen.getByText('23°')).toBeInTheDocument();
    expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
    expect(screen.getByText('Feels like 21°C')).toBeInTheDocument();
    expect(screen.getByText('London, England, United Kingdom')).toBeInTheDocument();
  });

  it('renders daily rows for today and upcoming days', () => {
    render(<Weather config={{ type: 'weather', location: 'London' }} data={DATA} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('25°')).toBeInTheDocument();
    expect(screen.getByText('15°')).toBeInTheDocument();
  });

  it('shows the empty state without data', () => {
    render(<Weather config={{ type: 'weather', location: 'London' }} data={null} />);
    expect(screen.getByText('No weather data.')).toBeInTheDocument();
  });
});
