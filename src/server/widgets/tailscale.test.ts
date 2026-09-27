import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './tailscale';
import type { TailscaleData } from '../../shared/widgets/payloads';

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

function makeCtx(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  env: Record<string, string | undefined> = {},
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
    const ctx = makeCtx(recorder(seen, inits));

    await fetcher()(ctx, { type: 'tailscale', 'api-key': 'tskey-secret' });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('/api/v2/tailnet/-/devices');
    expect(seen[0]).toContain('fields=all');
    expect((inits[0].headers as Record<string, string>).Authorization).toBe('Bearer tskey-secret');
  });

  it('reads the TS_API_KEY env var when the config carries no key', async () => {
    const inits: RequestInit[] = [];
    const ctx = makeCtx(recorder([], inits), { TS_API_KEY: 'tskey-env' });

    await fetcher()(ctx, { type: 'tailscale' });

    expect((inits[0].headers as Record<string, string>).Authorization).toBe('Bearer tskey-env');
  });

  it('prefers the config key over the environment', async () => {
    const inits: RequestInit[] = [];
    const ctx = makeCtx(recorder([], inits), { TS_API_KEY: 'tskey-env' });

    await fetcher()(ctx, { type: 'tailscale', 'api-key': 'tskey-config' });

    expect((inits[0].headers as Record<string, string>).Authorization).toBe('Bearer tskey-config');
  });

  it('URL-encodes an explicit tailnet name', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(recorder(seen));
    await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k', tailnet: 'example.com' });
    expect(seen[0]).toContain('/api/v2/tailnet/example.com/devices');
  });

  it('derives online from connectedToControl, never an "online" field', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
    const nas = data.devices.find((d) => d.name === 'nas.home.arpa')!;
    const laptop = data.devices.find((d) => d.name === 'laptop.home.arpa')!;
    expect(nas.online).toBe(true);
    expect(laptop.online).toBe(false);
    expect(nas.lastSeen).toBeNull();
    expect(laptop.lastSeen).toBe('2026-09-27T12:00:00Z');
  });

  it('keeps the 100.x address and drops the fd7a: IPv6', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
    expect(data.devices.find((d) => d.name === 'nas.home.arpa')!.address).toBe('100.101.102.103');
    // A node with no 100.x entry must not fall back to the ULA address.
    expect(data.devices.find((d) => d.name === 'guest')!.address).toBeNull();
  });

  it('prefers nodeId over the legacy numeric id', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
    expect(data.devices.find((d) => d.name === 'nas.home.arpa')!.id).toBe('nAAAA');
    // `guest` has no nodeId at all, so the legacy id is the fallback key.
    expect(data.devices.find((d) => d.name === 'guest')!.id).toBe('99999');
  });

  it('marks the exit node from enabledRoutes', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
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
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
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
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
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
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k', limit: 2 })) as TailscaleData;
    expect(data.devices.map((d) => d.name)).toEqual(['on-1', 'on-2']);
  });

  it('ignores device fields the widget does not render, and keeps a node with no address', async () => {
    const ctx = makeCtx(recorder());
    const data = (await fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })) as TailscaleData;
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
    await expect(fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })).resolves.toEqual({
      devices: [],
    });
  });

  it('throws without an api key, naming both routes to supply one', async () => {
    const ctx = makeCtx(recorder());
    await expect(fetcher()(ctx, { type: 'tailscale' })).rejects.toThrow(/api-key.*TS_API_KEY/i);
  });

  it('surfaces an upstream failure instead of rendering an empty tailnet', async () => {
    const ctx = makeCtx(async () => new Response('unauthorized', { status: 401 }));
    await expect(fetcher()(ctx, { type: 'tailscale', 'api-key': 'k' })).rejects.toThrow();
  });
});
