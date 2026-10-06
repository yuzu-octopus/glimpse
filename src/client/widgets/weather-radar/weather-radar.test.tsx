import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RadarData } from '../../../shared/widgets/payloads';
import { WeatherRadar, tileCoords } from './index';
import styles from './weather-radar.module.css';

const DATA: RadarData = {
  location: 'London',
  lat: 51.5,
  lon: -0.12,
  zoom: 7,
  tileUrlTemplate: 'https://tilecache.rainviewer.com/v2/radar/1700000600/256/{z}/{x}/{y}/4/1_1.png',
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
      expect(img.src).toContain('/v2/radar/1700000600/256/7/');
      expect(img.src).toContain('/4/1_1.png');
    }
    const xs = [...overlays].map((i) => Number(i.src.match(/\/7\/(\d+)\//)![1]));
    const ys = [...overlays].map((i) => Number(i.src.match(/\/7\/\d+\/(\d+)\//)![1]));
    // Window anchored on the NEAREST corner (63,42) so the location can be
    // centred; floor-anchoring would put it at 62 and expose a blank edge.
    expect(xs.slice().sort()).toEqual([63, 63, 64, 64]);
    expect(ys.slice().sort()).toEqual([42, 42, 43, 43]);

    const bases = [...container.querySelectorAll<HTMLImageElement>('img.base')];
    expect(bases).toHaveLength(4);
    expect(bases[0].src).toContain('tile.openstreetmap.org/7/');
  });

  it('clamps a payload zoom to the range RainViewer publishes', () => {
    // z 8+ is not served — the API returns 200 with a "Zoom level not
    // supported" placeholder — so a stale or hand-edited zoom must not
    // reach the tile URL. Both layers clamp to the same level, or the
    // overlay would sit on the wrong base tiles.
    const { container } = render(
      <WeatherRadar config={{ type: 'weather-radar', location: 'London' }} data={{ ...DATA, zoom: 10 }} />,
    );
    for (const img of container.querySelectorAll<HTMLImageElement>('img')) {
      expect(img.src).toContain('/7/');
      expect(img.src).not.toContain('/10/');
    }
    const xs = [...container.querySelectorAll<HTMLImageElement>('img.overlay')].map((i) =>
      Number(i.src.match(/\/7\/(\d+)\//)![1]),
    );
    expect(xs.slice().sort()).toEqual([63, 63, 64, 64]);
  });

  it('places the 2x2 grid around the exact-boundary coordinate', () => {
    const { container } = render(<WeatherRadar config={{ type: 'weather-radar', location: 'X' }} data={EQUATOR} />);
    const overlays = [...container.querySelectorAll<HTMLImageElement>('img.overlay')];
    const cells = overlays.map((i) => {
      const m = i.src.match(/\/3\/(\d+)\/(\d+)\/4\/1_1\.png$/);
      return m ? `${m[1]}/${m[2]}` : i.src;
    });
    expect(cells.sort()).toEqual(['3/3', '3/4', '4/3', '4/4']);
  });

  it('centers the map on Singapore at z7 (pixel offset, not just fx)', () => {
    const { container } = render(
      <WeatherRadar
        config={{ type: 'weather-radar', location: 'Singapore' }}
        data={{ ...DATA, location: 'Singapore', lat: 1.35, lon: 103.82, zoom: 7 }}
      />,
    );
    const tilesEl = container.querySelector<HTMLElement>(`.${styles.tiles}`);
    expect(tilesEl).not.toBeNull();
    const ox = parseFloat(tilesEl!.style.getPropertyValue('--ox'));
    const oy = parseFloat(tilesEl!.style.getPropertyValue('--oy'));

    // Singapore at z7 is tile coordinate (100.914, 63.520). The 2x2 window is
    // anchored on the NEAREST corner (100, 63) — not floor — so the layer
    // offset stays within [0,1] viewport widths and the map is centred without
    // exposing a blank edge. Values are in viewport widths.
    expect(ox).toBeCloseTo(0.4138, 3);
    expect(oy).toBeCloseTo(0.02, 3);

    // Reconstruct the location's pixel position from the RENDERED offset. The
    // window is translated left by ox, so it spans viewport grid [-ox, -ox + 2];
    // the location at grid column (x - baseX) = 0.9138 lands at 0.9138 - ox =
    // 0.5 viewport widths — dead centre, not the bottom-right corner.
    const { x, y } = tileCoords(1.35, 103.82, 7);
    expect(x - (Math.round(x) - 1) - ox).toBeCloseTo(0.5, 6);
    expect(y - (Math.round(y) - 1) - oy).toBeCloseTo(0.5, 6);
    // No blank edges: the 2-tile-wide window still spans the whole viewport.
    expect(-ox).toBeLessThanOrEqual(0);
    expect(-ox + 2).toBeGreaterThanOrEqual(1);
  });

  it('covers the viewport when the fractional part is just past 0.5', () => {
    // x = 64.51 at z7 (lat 0, lon 1.434375) — the case a floor-anchored window
    // gets wrong: floor gives base 63, which would require a 1.01-viewport
    // shift and slide the layer's left edge to +0.01, exposing a blank strip.
    // Round-anchoring gives base 64 and offset 0.01, so the 2-tile window still
    // spans the viewport.
    const { container } = render(
      <WeatherRadar config={{ type: 'weather-radar', location: 'Edge' }} data={{ ...DATA, location: 'Edge', lat: 0, lon: 1.434375, zoom: 7 }} />,
    );
    const tilesEl = container.querySelector<HTMLElement>(`.${styles.tiles}`)!;
    const ox = parseFloat(tilesEl.style.getPropertyValue('--ox'));
    const oy = parseFloat(tilesEl.style.getPropertyValue('--oy'));
    expect(ox).toBeCloseTo(0.01, 3);
    expect(oy).toBeCloseTo(0.5, 6);
    // The layer is translated left by ox viewports, so it spans [-ox, -ox + 2]
    // and [0, 1] must lie inside it.
    expect(-ox).toBeLessThanOrEqual(0);
    expect(-ox + 2).toBeGreaterThanOrEqual(1);
    // The window is anchored on the nearest corner (64), not the floor (63).
    const xs = [...container.querySelectorAll<HTMLImageElement>('img.overlay')]
      .map((i) => Number(i.src.match(/\/7\/(\d+)\//)![1]))
      .sort();
    expect(xs).toEqual([64, 64, 65, 65]);
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

  it('shows the frame timestamp with the location', () => {
    const { container } = render(<WeatherRadar config={{ type: 'weather-radar', location: 'London' }} data={DATA} />);
    expect(container.querySelector(`.${styles.timestamp}`)).toHaveTextContent('London · 22:23 UTC');
    // The colour token is deliberately NOT asserted: `--color-text-base-muted`
    // is owned by astryx-dracula, and pinning its name here is a freeze on the
    // kit that fires on any theme rename with no behaviour change. That the
    // timestamp is subdued text is the subdued-text contract test's job.
  });
});
