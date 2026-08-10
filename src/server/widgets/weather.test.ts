import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './weather';
import type { WeatherData } from './weather';

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

const weatherFetcher = () => serverWidgets.get('weather')!;


describe('weather fetcher', () => {
  it('geocodes then fetches the forecast', async () => {
    const ctx = makeCtx({
      'https://geocoding-api.open-meteo.com/v1/search': {
        results: [{ latitude: 51.5, longitude: -0.12, name: 'London', admin1: 'England', country: 'United Kingdom' }],
      },
      'https://api.open-meteo.com/v1/forecast': {
        current: { temperature_2m: 17.5, apparent_temperature: 16.2, relative_humidity_2m: 60, weather_code: 2 },
        daily: {
          time: ['2024-06-01', '2024-06-02'],
          weather_code: [0, 61],
          temperature_2m_max: [21, 19],
          temperature_2m_min: [12, 11],
        },
      },
    });
    const data = (await weatherFetcher()(ctx, { type: 'weather', location: 'London, United Kingdom' })) as WeatherData;
    expect(data.location).toBe('London, England, United Kingdom');
    expect(data.current.temp).toBe(17.5);
    expect(data.daily).toHaveLength(2);
    expect(data.daily[0].high).toBe(21);
  });

  it('throws when the location is unknown', async () => {
    const ctx = makeCtx({ 'https://geocoding-api.open-meteo.com/v1/search': { results: [] } });
    await expect(weatherFetcher()(ctx, { type: 'weather', location: 'Nowhere' })).rejects.toThrow('location not found');
  });
});
