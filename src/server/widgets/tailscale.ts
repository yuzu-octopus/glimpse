import { tailscaleSchema } from '../../shared/widgets/tailscale';
import type { TailscaleData, TailscaleDevice } from '../../shared/widgets/payloads';
import { fetchJson, retryOptionsFrom } from './http';
import { registerWidget } from './registry';

const API_BASE = 'https://api.tailscale.com';

/** A node is *serving* as exit node only when the default route is `enabled`.
 * `advertisedRoutes` alone just means it offered to — an admin still has to
 * approve it, and an approved-but-`::/0`-less node is IPv4-only. */
const EXIT_ROUTES: Record<string, true> = { '0.0.0.0/0': true, '::/0': true };

/** `GET /api/v2/tailnet/:tailnet/devices`, capped at the page size the API
 *  documents for this endpoint. */
const PAGE_SIZE = 100;

interface TailscaleDeviceDto {
  id?: string;
  nodeId?: string;
  name?: string;
  hostname?: string;
  /** The real online flag — the API has no `online` field. */
  connectedToControl?: boolean;
  lastSeen?: string | null;
  os?: string | null;
  clientVersion?: string | null;
  /** IPv4 first, then IPv6 (fd7a:… ULA). */
  addresses?: string[] | null;
  /** Only present when the request carries `fields=all`. */
  enabledRoutes?: string[] | null;
}

interface TailscaleDevicesResponse {
  devices?: TailscaleDeviceDto[] | null;
}

function toDevice(dto: TailscaleDeviceDto): TailscaleDevice {
  const id = dto.nodeId || dto.id || '';
  return {
    id,
    name: dto.name || dto.hostname || id || 'unknown',
    online: dto.connectedToControl === true,
    os: dto.os || null,
    clientVersion: dto.clientVersion || null,
    address: dto.addresses?.find((a) => a.startsWith('100.')) ?? null,
    lastSeen: dto.lastSeen || null,
    exitNode: (dto.enabledRoutes ?? []).some((r) => EXIT_ROUTES[r] === true),
  };
}

/** Online first — the widget's whole job is "who is reachable right now" —
 * then alphabetical within each group so the order is stable between polls. */
function byReachability(a: TailscaleDevice, b: TailscaleDevice): number {
  if (a.online !== b.online) return a.online ? -1 : 1;
  return a.name.localeCompare(b.name);
}

registerWidget('tailscale', async (ctx, config): Promise<TailscaleData> => {
  const cfg = tailscaleSchema.parse(config);
  const key = cfg['api-key'] ?? ctx.env.TS_API_KEY;
  if (!key) throw new Error('tailscale: missing api-key (set api-key or TS_API_KEY)');
  const retry = retryOptionsFrom(cfg);

  // `fields=all` is what carries enabledRoutes, so exit-node badges come out of
  // this same one call rather than a per-device route fetch.
  const url =
    `${API_BASE}/api/v2/tailnet/${encodeURIComponent(cfg.tailnet)}/devices` +
    `?fields=all&limit=${Math.min(cfg.limit, PAGE_SIZE)}`;

  // Bearer is one of two schemes Tailscale documents for an access token (the
  // other is HTTP basic with the key as username and an empty password, which
  // is what their own Go client sends).
  const res = await fetchJson<TailscaleDevicesResponse>(
    ctx,
    url,
    { headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } },
    retry,
  );

  const devices = (Array.isArray(res.devices) ? res.devices : []).map(toDevice).sort(byReachability);
  return { devices: devices.slice(0, cfg.limit) };
});
