import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RadarData } from '../../../shared/widgets/payloads';
import { WeatherRadar, tileCoords } from './index';

const DATA: RadarData = {
  location: 'London',
  lat: 51.5,
  lon: -0.12,
  zoom: 7,
  tileUrlTemplate: 'https://tilecache.rainviewer.com/v2/radar/1700000600/{z}/{x}/{y}/2/1_1.png',
  frameTime: 1700000600,
};

// lat 0 / lon 0 at zoom 3 lands exactly on tile boundary (4,4) — hand-checkable.
const EQUATOR: RadarData = {
  ...DATA,
  lat: 0,
  lon: 0,
  zoom: 3,
};

describe('tileCoords', () => {
  it('computes web-mercator tile coordinates', () => {
    expect(tileCoords(0, 0, 3)).toEqual({ x: 4, y: 4 });
    // London at z7 sits inside tile (63, 42)
    const c = tileCoords(51.5, -0.12, 7);
    expect(Math.floor(c.x)).toBe(63);
    expect(Math.floor(c.y)).toBe(42);
  });
});

describe('weather-radar widget', () => {
  it('renders a 2x2 grid of OSM base + rainviewer overlay tiles', () => {
    const { container } = render(<WeatherRadar config={{ type: 'weather-radar', location: 'London' }} data={DATA} />);
    const overlays = container.querySelectorAll<HTMLImageElement>('img.overlay');
    expect(overlays).toHaveLength(4);
    for (const img of overlays) {
      expect(img.src).toContain('/v2/radar/1700000600/7/');
      expect(img.src).toContain('/2/1_1.png');
    }
    const xs = [...overlays].map((i) => Number(i.src.match(/\/7\/(\d+)\//)![1]));
    const ys = [...overlays].map((i) => Number(i.src.match(/\/7\/\d+\/(\d+)\//)![1]));
    expect(xs.slice().sort()).toEqual([62, 62, 63, 63]);
    expect(ys.slice().sort()).toEqual([41, 41, 42, 42]);
    const bases = [...container.querySelectorAll<HTMLImageElement>('img.base')];
    expect(bases).toHaveLength(4);
    expect(bases[0].src).toContain('tile.openstreetmap.org/7/');
  });

  it('places the 2x2 grid around the exact-boundary coordinate', () => {
    const { container } = render(<WeatherRadar config={{ type: 'weather-radar', location: 'X' }} data={EQUATOR} />);
    const overlays = [...container.querySelectorAll<HTMLImageElement>('img.overlay')];
    const cells = overlays.map((i) => {
      const m = i.src.match(/\/3\/(\d+)\/(\d+)\/2\/1_1\.png$/);
      return m ? `${m[1]}/${m[2]}` : i.src;
    });
    expect(cells.sort()).toEqual(['3/3', '3/4', '4/3', '4/4']);
  });

  it('shows the location and frame timestamp in UTC', () => {
    render(<WeatherRadar config={{ type: 'weather-radar', location: 'London' }} data={DATA} />);
    // 1700000600 -> 2023-11-14T22:23:20Z
    expect(screen.getByText('London · 22:23 UTC')).toBeInTheDocument();
  });

  it('falls back to "live" without a frame time', () => {
    render(
      <WeatherRadar
        config={{ type: 'weather-radar', location: 'London' }}
        data={{ ...DATA, frameTime: null }}
      />,
    );
    expect(screen.getByText('London · live')).toBeInTheDocument();
  });

  it('shows the empty state without data', () => {
    render(<WeatherRadar config={{ type: 'weather-radar', location: 'London' }} data={null} isLoading={false} />);
    expect(screen.getByText('No radar data.')).toBeInTheDocument();
  });

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <WeatherRadar
        config={{ type: 'weather-radar', title: 'Radar', location: 'London' }}
        data={null}
        error="location not found"
      />,
    );
    expect(screen.getByText('location not found')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });
});
