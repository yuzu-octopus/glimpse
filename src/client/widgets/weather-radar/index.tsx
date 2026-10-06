import type { RadarConfig } from '../../../shared/widgets/radar';
import type { RadarData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './weather-radar.module.css';
import type { CSSProperties } from 'react';

// eslint-disable-next-line react-doctor/only-export-components -- tileCoords is a pure helper used by tests
export function tileCoords(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

const TIME_FMT_UTC = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});
/** Frame time in the radar's own zone (Singapore reads SGT, not UTC).
 *  A bogus zone falls back to UTC rather than throwing on render. */
function formatFrame(frameTime: number, timezone: string | null): string {
  const date = new Date(frameTime * 1000);
  if (timezone) {
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
      const short = timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone;
      return `${fmt.format(date)} ${short}`;
    } catch {
      // fall through to UTC
    }
  }
  return `${TIME_FMT_UTC.format(date)} UTC`;
}

const SHARED_IMG = { draggable: false } as const;

/**
 * RainViewer publishes radar tiles for z 0–7 only (probed against the live
 * API). Beyond that it answers HTTP 200 with a "Zoom level not supported"
 * placeholder, so an out-of-range zoom in the payload renders as a broken
 * image rather than an error — clamp before it reaches the tile URL.
 */
const MAX_ZOOM = 7;

export function WeatherRadar({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as RadarConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const w = data as RadarData | null;

  if (loading) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} isLoading error={error} showErrors={cfg['show-errors']} />
    );
  }
  if (!w) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} error={error} showErrors={cfg['show-errors']}>
        <div className={styles.empty}>No radar data.</div>
      </WidgetChrome>
    );
  }

  const zoom = Math.min(w.zoom, MAX_ZOOM);
  const { x, y } = tileCoords(w.lat, w.lon, zoom);
  // Centre the location, not just keep it on screen. Anchor the 2x2 window on
  // the NEAREST tile corner (round, not floor) so the layer can always be
  // shifted by ≤ half a viewport and still cover the frame; a floor-anchored
  // window cannot centre a location whose fractional part is > 0.5 without
  // exposing a blank edge. `o*` is the layer offset in viewport widths.
  const baseX = Math.round(x) - 1;
  const baseY = Math.round(y) - 1;
  const ox = x - baseX - 0.5;
  const oy = y - baseY - 0.5;
  const tiles = [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ tx: baseX + dx, ty: baseY + dy })));

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.map} role="img" aria-label={`Radar map for ${w.location}`}>
        <div
          className={styles.tiles}
          style={{ '--ox': ox, '--oy': oy } as CSSProperties}
        >
          {tiles.map(({ tx, ty }) => (
            <div key={`${tx}:${ty}`} className={styles.cell}>
              <img {...SHARED_IMG} className={`${styles.base} base`} src={`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`} alt="" loading="lazy" />
              <img
                {...SHARED_IMG}
                className={`${styles.overlay} overlay`}
                src={w.tileUrlTemplate.replace('{z}', String(zoom)).replace('{x}', String(tx)).replace('{y}', String(ty))}
                alt=""
                loading="lazy"
              />
            </div>
          ))}
      </div>
      </div>
      <div className={styles.timestamp}>
        {w.location} · {w.frameTime != null ? formatFrame(w.frameTime, w.timezone ?? null) : 'live'}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('weather-radar', WeatherRadar);
export default WeatherRadar;
