import { RADAR_DEFAULTS, radarSchema } from '../../shared/widgets/radar';
import type { RadarData } from '../../shared/widgets/payloads';
import { fetchJson, retryOptionsFrom } from './http';
import { registerWidget } from './registry';
import { geocodeLocation } from './weather';

const DEFAULT_TILE_HOST = 'https://tilecache.rainviewer.com';

/**
 * RainViewer tile URLs are `{path}/{size}/{z}/{x}/{y}/{color}/{options}.png`
 * — the size segment comes FIRST. Probed against the live API: any request
 * with z above `MAX_ZOOM` returns HTTP 200 and a 1370-byte "Zoom level not
 * supported" placeholder rather than an error, so a bad request looks like
 * a successful one. The published range is z 0–7 for both tile sizes.
 */
const MAX_ZOOM = 7;

interface RainViewerFrame {
  time: number;
  path: string;
}

interface RainViewerMaps {
  host?: string;
  radar?: { past?: RainViewerFrame[] };
}

registerWidget('weather-radar', async (ctx, config) => {
  const cfg = radarSchema.parse(config);
  // A configured zoom above the published range returns a 200-with-placeholder
  // rather than an error, so it has to be clamped here, not discovered.
  const zoom = Math.min(cfg.zoom ?? RADAR_DEFAULTS.zoom, MAX_ZOOM);
  const place = await geocodeLocation(ctx, cfg.location, retryOptionsFrom(cfg));

  // eslint-disable-next-line react-doctor/server-sequential-independent-await -- place needed for error precedence (location 404 should win over radar 404)
  const maps = await fetchJson<RainViewerMaps>(ctx, 'https://api.rainviewer.com/public/weather-maps.json', {}, retryOptionsFrom(cfg));
  const past = maps.radar?.past ?? [];
  const last = past[past.length - 1];
  if (!last) throw new Error('no radar frames available');

  const host = (maps.host || DEFAULT_TILE_HOST).replace(/\/$/, '');
  const data: RadarData = {
    location: place.name ?? cfg.location,
    lat: place.latitude as number,
    lon: place.longitude as number,
    zoom,
    tileUrlTemplate: `${host}${last.path}/256/{z}/{x}/{y}/4/1_1.png`,
    frameTime: typeof last.time === 'number' ? last.time : null,
  };
  return data;
});
