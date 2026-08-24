import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './weather-radar';
import type { RadarData } from '../../shared/widgets/payloads';

function makeCtx(routes: Record<string, unknown>): WidgetFetchContext {
  const fetchImpl = async (url: string) => {
    for (const [prefix, payload] of Object.entries(routes)) {
      if (url.startsWith(prefix)) return new Response(JSON.stringify(payload), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const RAINVIEWER = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1700000000, path: '/v2/radar/1700000000' },
      { time: 1700000600, path: '/v2/radar/1700000600' },
    ],
  },
};

const GEO = {
  results: [{ latitude: 51.5, longitude: -0.12, name: 'London', country: 'United Kingdom' }],
};

const radarFetcher = () => serverWidgets.get('weather-radar')!;

describe('weather-radar fetcher', () => {
  it('geocodes then builds a tile template from the last rainviewer frame', async () => {
    const ctx = makeCtx({
      'https://geocoding-api.open-meteo.com/v1/search': GEO,
      'https://api.rainviewer.com/public/weather-maps.json': RAINVIEWER,
    });
    const data = (await radarFetcher()(ctx, { type: 'weather-radar', location: 'London' })) as RadarData;
    expect(data.location).toBe('London');
    expect(data.lat).toBe(51.5);
    expect(data.lon).toBe(-0.12);
    expect(data.zoom).toBe(7);
    expect(data.tileUrlTemplate).toBe(
      'https://tilecache.rainviewer.com/v2/radar/1700000600/{z}/{x}/{y}/2/1_1.png',
    );
    expect(data.frameTime).toBe(1700000600);
  });

  it('honours a configured zoom', async () => {
    const ctx = makeCtx({
      'https://geocoding-api.open-meteo.com/v1/search': GEO,
      'https://api.rainviewer.com/public/weather-maps.json': RAINVIEWER,
    });
    const data = (await radarFetcher()(ctx, { type: 'weather-radar', location: 'London', zoom: 5 })) as RadarData;
    expect(data.zoom).toBe(5);
  });

  it('rejects an out-of-range zoom', async () => {
    const ctx = makeCtx({});
    await expect(
      radarFetcher()(ctx, { type: 'weather-radar', location: 'London', zoom: 11 }),
    ).rejects.toThrow();
  });

  it('throws when no radar frames are available', async () => {
    const ctx = makeCtx({
      'https://geocoding-api.open-meteo.com/v1/search': GEO,
      'https://api.rainviewer.com/public/weather-maps.json': { radar: { past: [] } },
    });
    await expect(radarFetcher()(ctx, { type: 'weather-radar', location: 'London' })).rejects.toThrow(
      'no radar frames available',
    );
  });

  it('throws when the location is unknown', async () => {
    const ctx = makeCtx({
      'https://geocoding-api.open-meteo.com/v1/search': { results: [] },
    });
    await expect(radarFetcher()(ctx, { type: 'weather-radar', location: 'Nowhere' })).rejects.toThrow(
      'location not found',
    );
  });
});
