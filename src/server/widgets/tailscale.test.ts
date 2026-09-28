import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './tailscale';
import type { TailscaleData } from '../../shared/widgets/payloads';
import { tailscaleSchema } from '../../shared/widgets/tailscale';

/** Shaped off tailscale-client-go-v2's Device struct: there is no `online`
 *  field, connectivity is `connectedToControl`, and `lastSeen` is null while
 *  connected. `enabledRoutes` only arrives with `fields=all`. */
const DEVICES_FIXTURE = {
  devices: [
    {
      id: '12345',
      nodeId: 'nAAAA',
      name: 'nas.home.arpa',
      hostname: 'nas',
      connectedToControl: true,
      lastSeen: null,
      os: 'linux',
      clientVersion: '1.90.2',
      addresses: ['100.101.102.103', 'fd7a:115c:a1e0::1'],
      enabledRoutes: ['0.0.0.0/0', '::/0'],
      authorized: true,
      user: 'admin@example.com',
      tags: ['tag:server'],
    },
    {
      id: '67890',
      nodeId: 'nBBBB',
      name: 'laptop.home.arpa',
      hostname: 'laptop',
      connectedToControl: false,
      lastSeen: '2026-09-27T12:00:00Z',
      os: 'macOS',
      clientVersion: '1.88.0',
      addresses: ['100.64.7.7'],
      enabledRoutes: [],
      authorized: true,
      user: 'admin@example.com',
      tags: [],
    },
    {
      id: '99999',
      name: 'guest',
      hostname: 'guest',
      connectedToControl: false,
      lastSeen: '2026-09-20T08:30:00Z',
      addresses: [],
      authorized: false,
      tags: null,
    },
  ],
};

/** The widget's only credential source — TS_API_KEY, never the config. */
const KEY_ENV = { TS_API_KEY: 'tskey-env' };

function makeCtx(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  env: Record<string, string | undefined> = KEY_ENV,
): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('tailscale')!;

/** Records every request and serves `body`, so a request that escapes the
 *  expected path cannot quietly pass. */
function recorder(seen: string[] = [], inits: RequestInit[] = [], body: unknown = DEVICES_FIXTURE) {
  return async (url: string, init?: RequestInit) => {
    seen.push(url);
    inits.push(init ?? {});
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

const body = (devices: unknown[]) => ({ devices });

describe('tailscale fetcher', () => {
  it('calls the devices endpoint with a Bearer token and fields=all', async () => {
    const seen: string[] = [];
    const inits: RequestInit[] = [];
    const ctx = makeCtx(recorder(seen, inits), { TS_API_KEY: 'tskey-secret' });

    await fetcher()(ctx, { type: 'tailscale' });

    expect(seen).toHaveLength(1);
    // Pinned exactly: `fields=all` is the one query param the official
    // tailscale-client-go sends on this endpoint. Anything else (a `limit`
    // we invented, say) risks a 400 from an API that ignores unknown keys.
    expect(seen[0]).toBe('https://api.tailscale.com/api/v2/tailnet/-/devices?fields=all');
    expect((inits[0].headers as Record<string, string>).Authorization).toBe('Bearer tskey-secret');
  });

  it('ignores an api-key left in the config — the schema strips it', async () => {
    const inits: RequestInit[] = [];
    const ctx = makeCtx(recorder([], inits), { TS_API_KEY: 'tskey-env' });

    await fetcher()(ctx, { type: 'tailscale', 'api-key': 'tskey-config' });

    expect((inits[0].headers as Record<string, string>).Authorization).toBe('Bearer tskey-env');
    expect('api-key' in tailscaleSchema.parse({ type: 'tailscale', 'api-key': 'leaked' })).toBe(false);
  });


  it('URL-encodes an explicit tailnet name', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(recorder(seen));
    await fetcher()(ctx, { type: 'tailscale', tailnet: 'example.com' });
    expect(seen[0]).toContain('/api/v2/tailnet/example.com/devices');
  });

  it('derives online from connectedToControl, never an "online" field', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    const nas = data.devices.find((d) => d.name === 'nas.home.arpa')!;
    const laptop = data.devices.find((d) => d.name === 'laptop.home.arpa')!;
    expect(nas.online).toBe(true);
    expect(laptop.online).toBe(false);
    expect(nas.lastSeen).toBeNull();
    expect(laptop.lastSeen).toBe('2026-09-27T12:00:00Z');
  });

  it('keeps the 100.x address and drops the fd7a: IPv6', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    expect(data.devices.find((d) => d.name === 'nas.home.arpa')!.address).toBe('100.101.102.103');
    // A node with no 100.x entry must not fall back to the ULA address.
    expect(data.devices.find((d) => d.name === 'guest')!.address).toBeNull();
  });

  it('prefers nodeId over the legacy numeric id', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    expect(data.devices.find((d) => d.name === 'nas.home.arpa')!.id).toBe('nAAAA');
    // `guest` has no nodeId at all, so the legacy id is the fallback key.
    expect(data.devices.find((d) => d.name === 'guest')!.id).toBe('99999');
  });

  it('marks the exit node from enabledRoutes', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    expect(data.devices.find((d) => d.name === 'nas.home.arpa')!.exitNode).toBe(true);
    expect(data.devices.find((d) => d.name === 'laptop.home.arpa')!.exitNode).toBe(false);
  });

  it('does not mark a node whose default route is advertised but not enabled', async () => {
    const ctx = makeCtx(
      recorder(
        [],
        [],
        body([{ name: 'offer', connectedToControl: true, enabledRoutes: [], advertisedRoutes: ['0.0.0.0/0'] }]),
      ),
    );
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    expect(data.devices[0].exitNode).toBe(false);
  });

  it('lists online nodes first, then offline, each group by name', async () => {
    const ctx = makeCtx(
      recorder(
        [],
        [],
        body([
          { name: 'z-offline', connectedToControl: false, lastSeen: '2026-09-01T00:00:00Z' },
          { name: 'b-online', connectedToControl: true },
          { name: 'a-online', connectedToControl: true },
        ]),
      ),
    );
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    expect(data.devices.map((d) => d.name)).toEqual(['a-online', 'b-online', 'z-offline']);
  });

  it('applies limit after ordering, so the visible head is the online nodes', async () => {
    const ctx = makeCtx(
      recorder(
        [],
        [],
        body([
          { name: 'off-1', connectedToControl: false },
          { name: 'on-1', connectedToControl: true },
          { name: 'on-2', connectedToControl: true },
        ]),
      ),
    );
    const data = (await fetcher()(ctx, { type: 'tailscale', limit: 2 })) as TailscaleData;
    expect(data.devices.map((d) => d.name)).toEqual(['on-1', 'on-2']);
  });

  it('ignores device fields the widget does not render, and keeps a node with no address', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale' })) as TailscaleData;
    const guest = data.devices.find((d) => d.name === 'guest')!;
    // The API sends user/tags/authorized; none of them reach the payload.
    expect(guest).toEqual({
      id: '99999',
      name: 'guest',
      online: false,
      os: null,
      clientVersion: null,
      address: null,
      lastSeen: '2026-09-20T08:30:00Z',
      exitNode: false,
    });
  });

  it('tolerates a response with no devices key', async () => {
    const ctx = makeCtx(recorder([], [], {}));
    await expect(fetcher()(ctx, { type: 'tailscale' })).resolves.toEqual({
      devices: [],
    });
  });

  it('throws when TS_API_KEY is unset, naming the env var to set', async () => {
    const ctx = makeCtx(recorder(), {});
    await expect(fetcher()(ctx, { type: 'tailscale' })).rejects.toThrow(/TS_API_KEY/);
  });

  it('surfaces an upstream failure instead of rendering an empty tailnet', async () => {
    // The title's claim — fail loudly rather than degrade to `{devices: []}` —
    // is only distinguishable from the tolerates-an-empty-response test by the
    // thrown message. A bare toThrow passes on both paths.
    const ctx = makeCtx(async () => new Response('unauthorized', { status: 401 }));
    // The `?…` is the point: sanitizeUrl truncates the query so a credential
    // in it can never reach a payload.error the browser renders.
    await expect(fetcher()(ctx, { type: 'tailscale' })).rejects.toThrow(
      'HTTP 401 for https://api.tailscale.com/api/v2/tailnet/-/devices?…',
    );
  });
});
