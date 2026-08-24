import { weatherSchema } from '../../shared/widgets/feeds';
import { registerWidget, type WidgetFetchContext } from './registry';
import { fetchJson } from './http';
import type { WeatherData, WeatherDay } from '../../shared/widgets/payloads';


interface ForecastCurrent {
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  weather_code?: number;
}

interface ForecastDaily {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

interface ForecastResponse {
  current?: ForecastCurrent;
  daily?: ForecastDaily;
}

export interface GeocodePlace {
  latitude?: number;
  longitude?: number;
  name?: string;
  admin1?: string;
  country?: string;
}

/** Shared open-meteo geocoding — used by weather + weather-radar. */
export async function geocodeLocation(
  ctx: WidgetFetchContext,
  location: string,
): Promise<GeocodePlace> {
  const geo = await fetchJson<{ results?: GeocodePlace[] }>(
    ctx,
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
  );
  const place = geo.results?.[0];
  if (!place || place.latitude == null || place.longitude == null) {
    throw new Error(`location not found: ${location}`);
  }
  return place;
}

registerWidget('weather', async (ctx, config) => {
  const cfg = weatherSchema.parse(config);
  const units = cfg.units ?? 'metric';

  const place = await geocodeLocation(ctx, cfg.location);

  const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
  const windUnit = units === 'metric' ? 'kmh' : 'mph';
  const forecast = await fetchJson<ForecastResponse>(
    ctx,
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7` +
      `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto`,
  );

  const area =
    [place.name, place.admin1, place.country].filter(Boolean).join(', ') ||
    cfg.location;

  const daily: WeatherDay[] = [];
  const d = forecast.daily;
  if (d?.time) {
    for (let i = 0; i < d.time.length; i++) {
      daily.push({
        date: d.time[i],
        code: d.weather_code?.[i] ?? null,
        high: d.temperature_2m_max?.[i] ?? null,
        low: d.temperature_2m_min?.[i] ?? null,
      });
    }
  }

  const data: WeatherData = {
    location: area,
    current: {
      temp: forecast.current?.temperature_2m ?? null,
      feelsLike: forecast.current?.apparent_temperature ?? null,
      humidity: forecast.current?.relative_humidity_2m ?? null,
      code: forecast.current?.weather_code ?? null,
    },
    daily,
  };
  return data;
});
