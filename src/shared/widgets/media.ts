import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';
// No widget here declares a credential. The config is served to the browser
// verbatim (`GET /api/config`, `GET /api/page/:slug` put every widget's whole
// `config` on the wire), so a key in the YAML is a key in the page — and
// `${VAR}` is substituted before the schema runs, so interpolating one in
// leaks the value just as surely as writing it literally. Credentials come
// from the environment instead, read by the fetcher: IMMICH_API_KEY,
// JELLYFIN_API_KEY, QBITTORRENT_USERNAME/QBITTORRENT_PASSWORD,
// TRANSMISSION_USERNAME/TRANSMISSION_PASSWORD.

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const IMMICH_DEFAULTS = { limit: 10 } as const;
export const IMMICH_PREF: Pref = { cols: 6, rows: 2, resizable: false, priority: 7, zone: 'main', preferredWidth: 380, preferredHeight: 240 };
export const IMMICH_SKELETON: SkeletonShape = 'chart';

export const JELLYFIN_DEFAULTS = { limit: 10 } as const;
export const JELLYFIN_PREF: Pref = { cols: 6, rows: 2, resizable: false, priority: 7, zone: 'main', preferredWidth: 380, preferredHeight: 240 };
export const JELLYFIN_SKELETON: SkeletonShape = 'chart';

export const QBITTORRENT_DEFAULTS = { limit: 10 } as const;
export const QBITTORRENT_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 360, preferredHeight: 240 };
export const QBITTORRENT_SKELETON: SkeletonShape = 'rows';

export const TRANSMISSION_DEFAULTS = { limit: 10 } as const;
export const TRANSMISSION_PREF: Pref = { cols: 4, rows: 2, resizable: false, priority: 6, zone: 'main', preferredWidth: 360, preferredHeight: 240 };
export const TRANSMISSION_SKELETON: SkeletonShape = 'rows';

export const immichSchema = z.object({
  type: z.literal('immich'),
  ...sharedWidgetFields,
  /** Base URL of the Immich instance, e.g. https://immich.lab */
  url: z.string(),
  limit: z.number().int().min(0).default(IMMICH_DEFAULTS.limit),
});
export type ImmichConfig = z.infer<typeof immichSchema>;

export const jellyfinSchema = z.object({
  type: z.literal('jellyfin'),
  ...sharedWidgetFields,
  /** Base URL of the Jellyfin instance, e.g. https://jellyfin.lab */
  url: z.string(),
  /** Jellyfin user id for /Items/Latest; auto-resolved to the first user when omitted. */
  'user-id': z.string().optional(),
  limit: z.number().int().min(0).default(JELLYFIN_DEFAULTS.limit),
});
export type JellyfinConfig = z.infer<typeof jellyfinSchema>;

export const qbittorrentSchema = z.object({
  type: z.literal('qbittorrent'),
  ...sharedWidgetFields,
  /** Base URL of the qBittorrent WebUI, e.g. http://qb.lab:8080 */
  url: z.string(),
  limit: z.number().int().min(0).default(QBITTORRENT_DEFAULTS.limit),
});
export type QbittorrentConfig = z.infer<typeof qbittorrentSchema>;

export const transmissionSchema = z.object({
  type: z.literal('transmission'),
  ...sharedWidgetFields,
  /** Base URL of Transmission, e.g. http://transmission.lab:9091 */
  url: z.string(),
  limit: z.number().int().min(0).default(TRANSMISSION_DEFAULTS.limit),
});
export type TransmissionConfig = z.infer<typeof transmissionSchema>;
