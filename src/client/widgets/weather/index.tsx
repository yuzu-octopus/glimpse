import {
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
} from 'lucide-react';
import { weatherSchema } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { WeatherData } from '../../../server/widgets/weather';
import styles from './weather.module.css';

/** WMO weather code → lucide icon (open-meteo codes). */
function weatherIcon(code: number | null) {
  if (code === null || code === 0) return <Sun size={18} />;
  if (code <= 3) return <CloudSun size={18} />;
  if (code <= 48) return <CloudFog size={18} />;
  if (code <= 67 || code <= 82) return <CloudRain size={18} />;
  if (code <= 77) return <CloudSnow size={18} />;
  return <CloudLightning size={18} />;
}

const DAY_NAMES = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

function Weather({ config, data }: WidgetComponentProps) {
  const cfg = weatherSchema.parse(config);
  const w = data as WeatherData | null;
  if (!w) return <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}><div className={styles.empty}>No weather data.</div></WidgetChrome>;

  const today = new Date().toISOString().slice(0, 10);
  const day = (date: string) => (date === today ? 'Today' : DAY_NAMES.format(new Date(date + 'T00:00:00')));

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      {!cfg['hide-location'] ? <div className={styles.location}>{w.location}</div> : null}
      <div className={styles.current}>
        <div className={styles.temp}>{w.current.temp != null ? `${Math.round(w.current.temp)}°` : '—'}</div>
        <div className={styles.currentIcon}>{weatherIcon(w.current.code)}</div>
      </div>
      <div className={styles.details}>
        {w.current.feelsLike != null ? (
          <span className={styles.detail}>
            <Thermometer size={13} /> feels {Math.round(w.current.feelsLike)}°
          </span>
        ) : null}
        {w.current.humidity != null ? (
          <span className={styles.detail}>
            <Droplets size={13} /> {w.current.humidity}%
          </span>
        ) : null}
      </div>
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
