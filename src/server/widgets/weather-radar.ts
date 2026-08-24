import { RADAR_DEFAULTS, radarSchema } from '../../shared/widgets/radar';
import type { RadarData } from '../../shared/widgets/payloads';
import { fetchJson } from './http';
import { registerWidget } from './registry';
import { geocodeLocation } from './weather';

const DEFAULT_TILE_HOST = 'https://tilecache.rainviewer.com';

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
  const zoom = cfg.zoom ?? RADAR_DEFAULTS.zoom;
  const place = await geocodeLocation(ctx, cfg.location);

  const maps = await fetchJson<RainViewerMaps>(
    ctx,
    'https://api.rainviewer.com/public/weather-maps.json',
  );
  const past = maps.radar?.past ?? [];
  const last = past[past.length - 1];
  if (!last) throw new Error('no radar frames available');

  const host = (maps.host || DEFAULT_TILE_HOST).replace(/\/$/, '');
  const data: RadarData = {
    location: place.name ?? cfg.location,
    lat: place.latitude as number,
    lon: place.longitude as number,
    zoom,
    tileUrlTemplate: `${host}${last.path}/{z}/{x}/{y}/2/1_1.png`,
    frameTime: typeof last.time === 'number' ? last.time : null,
  };
  return data;
});

