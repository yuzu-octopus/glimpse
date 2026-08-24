import type { RadarConfig } from '../../../shared/widgets/radar';
import type { RadarData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './weather-radar.module.css';

/** Web-mercator tile coordinates (fractional) for lat/lon at a zoom level. */
export function tileCoords(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const SHARED_IMG = { draggable: false } as const;

export function WeatherRadar({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as RadarConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const w = data as RadarData | null;

  if (loading) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} isLoading error={error} />
    );
  }
  if (!w) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} error={error}>
        <div className={styles.empty}>No radar data.</div>
      </WidgetChrome>
    );
  }

  const { x, y } = tileCoords(w.lat, w.lon, w.zoom);
  const baseX = Math.floor(x) - 1;
  const baseY = Math.floor(y) - 1;
  const tiles = [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ tx: baseX + dx, ty: baseY + dy })));

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.map} role="img" aria-label={`Radar map for ${w.location}`}>
        <div className={styles.tiles}>
          {tiles.map(({ tx, ty }) => (
            <div key={`${tx}:${ty}`} className={styles.cell}>
              <img {...SHARED_IMG} className={`${styles.base} base`} src={`https://tile.openstreetmap.org/${w.zoom}/${tx}/${ty}.png`} alt="" loading="lazy" />
              <img
                {...SHARED_IMG}
                className={`${styles.overlay} overlay`}
                src={w.tileUrlTemplate.replace('{z}', String(w.zoom)).replace('{x}', String(tx)).replace('{y}', String(ty))}
                alt=""
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.timestamp}>
        {w.location} · {w.frameTime != null ? `${TIME_FMT.format(new Date(w.frameTime * 1000))} UTC` : 'live'}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('weather-radar', WeatherRadar);
export default WeatherRadar;
