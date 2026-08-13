import {
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';
import type { WeatherConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { WeatherData } from '../../../shared/widgets/payloads';
import styles from './weather.module.css';

/** WMO weather code → lucide icon (open-meteo codes). */
function weatherIcon(code: number | null) {
  if (code === null || code === 0) return <Sun size={18} />;
  if (code <= 3) return <CloudSun size={18} />;
  if (code <= 48) return <CloudFog size={18} />;
  if (code <= 67) return <CloudRain size={18} />; // drizzle + rain
  if (code <= 77) return <CloudSnow size={18} />; // 71–77
  if (code <= 82) return <CloudRain size={18} />; // rain showers
  if (code <= 86) return <CloudSnow size={18} />; // snow showers
  return <CloudLightning size={18} />;            // 95–99
}

/** WMO weather code → condition label (glance weatherCodeTable). */
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  56: 'Drizzle',
  57: 'Drizzle',
  61: 'Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  66: 'Freezing Rain',
  67: 'Freezing Rain',
  71: 'Snow',
  73: 'Moderate Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Rain',
  81: 'Moderate Rain',
  82: 'Heavy Rain',
  85: 'Snow',
  86: 'Snow',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

const DAY_NAMES = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

export function Weather({ config, data, error }: WidgetComponentProps) {
  const cfg = config as unknown as WeatherConfig;
  const w = data as WeatherData | null;
  if (!w) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} error={error}>
        <div className={styles.empty}>No weather data.</div>
      </WidgetChrome>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const day = (date: string) => (date === today ? 'Today' : DAY_NAMES.format(new Date(date + 'T00:00:00')));

  const unit = (cfg.units ?? 'metric') === 'metric' ? 'C' : 'F';
  const condition = w.current.code != null ? WEATHER_CODES[w.current.code] : undefined;

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.current}>
        <div className={styles.temp}>{w.current.temp != null ? `${Math.round(w.current.temp)}°` : '—'}</div>
        <div className={styles.currentIcon}>{weatherIcon(w.current.code)}</div>
      </div>
      {condition ? <div className={styles.condition}>{condition}</div> : null}
      {w.current.feelsLike != null ? (
        <div className={styles.feelsLike}>
          Feels like {Math.round(w.current.feelsLike)}°{unit}
        </div>
      ) : null}
      {!cfg['hide-location'] ? (
        <div className={styles.location}>
          <span className={styles.locationIcon} aria-hidden="true" />
          <span className={styles.locationText}>{w.location}</span>
        </div>
      ) : null}
      <div className={styles.daily}>
        {w.daily.slice(0, 7).map((d) => (
          <div key={d.date} className={styles.dayRow}>
            <span className={styles.dayName}>{day(d.date)}</span>
            {weatherIcon(d.code)}
            <span className={styles.temps}>
              {d.high != null ? `${Math.round(d.high)}°` : '—'}
              <span className={styles.low}>{d.low != null ? ` ${Math.round(d.low)}°` : ''}</span>
            </span>
          </div>
        ))}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('weather', Weather);
