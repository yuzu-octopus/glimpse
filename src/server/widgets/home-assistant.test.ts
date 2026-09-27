import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './home-assistant';
import type { HomeAssistantData } from '../../shared/widgets/payloads';

const STATES = [
  {
    entity_id: 'binary_sensor.front_door',
    state: 'off',
    attributes: { friendly_name: 'Front Door', device_class: 'door' },
  },
  {
    entity_id: 'binary_sensor.garage_door',
    state: 'on',
    attributes: { friendly_name: 'Garage', device_class: 'garage_door' },
  },
  { entity_id: 'binary_sensor.hall_motion', state: 'on', attributes: { device_class: 'motion' } },
  { entity_id: 'light.kitchen', state: 'on', attributes: { friendly_name: 'Kitchen' } },
  { entity_id: 'lock.front', state: 'off', attributes: { friendly_name: 'Deadbolt' } },
  {
    entity_id: 'sensor.living_room_temp',
    state: '21.5',
    attributes: { unit_of_measurement: '°C', device_class: 'temperature' },
  },
  { entity_id: 'sensor.lamp_watts', state: 'unknown', attributes: { friendly_name: 'Lamp' } },
  { entity_id: 'sensor.unused_by_config', state: '5', attributes: { friendly_name: 'Unused' } },
];

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

interface FakeCtx {
  ctx: WidgetFetchContext;
  calls: FetchCall[];
}

/** Records every request so the test can assert on the wire, not just output. */
function makeCtx(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  env: Record<string, string | undefined> = {},
): FakeCtx {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return fetchImpl(url, init);
  });
  const ctx: WidgetFetchContext = {
    fetch: fetchMock as unknown as typeof fetch,
    env,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
  return { ctx, calls };
}

const jsonCtx = (env: Record<string, string | undefined> = {}): FakeCtx =>
  makeCtx(async () => new Response(JSON.stringify(STATES), { status: 200 }), env);

const fetcher = () => serverWidgets.get('home-assistant')!;

const fetchWith = (entities: unknown[], env: Record<string, string | undefined> = {}) =>
  fetcher()(jsonCtx(env).ctx, {
    type: 'home-assistant',
    url: 'http://ha.local:8123',
    token: 'tok',
    entities,
  }) as Promise<HomeAssistantData>;

describe('home-assistant fetcher', () => {
  it('fetches /api/states once and filters to the configured entities in order', async () => {
    const { ctx, calls } = jsonCtx();
    const data = (await fetcher()(ctx, {
      type: 'home-assistant',
      url: 'http://ha.local:8123/',
      token: 'tok',
      entities: ['sensor.living_room_temp', 'binary_sensor.front_door', 'sensor.unused_by_config'],
    })) as HomeAssistantData;

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://ha.local:8123/api/states');
    expect(calls[0].init?.headers).toMatchObject({ authorization: 'Bearer tok' });
    expect(data.entities.map((e) => e.id)).toEqual([
      'sensor.living_room_temp',
      'binary_sensor.front_door',
      'sensor.unused_by_config',
    ]);
  });

  it('reads the long-lived token from HA_TOKEN', async () => {
    const { ctx, calls } = jsonCtx({ HA_TOKEN: 'env-tok' });
    const data = (await fetcher()(ctx, {
      type: 'home-assistant',
      url: 'http://ha.local:8123',
      entities: ['light.kitchen'],
    })) as HomeAssistantData;
    expect(calls[0].init?.headers).toMatchObject({ authorization: 'Bearer env-tok' });
    expect(data.entities[0].value).toBe('On');
  });

  it('throws a legible error when /api/states is not an entity list', async () => {
    const { ctx } = makeCtx(async () => new Response('{"message":"Invalid access token"}', { status: 200 }));
    await expect(
      fetcher()(ctx, { type: 'home-assistant', url: 'http://ha.local:8123', token: 'bad', entities: ['light.kitchen'] }),
    ).rejects.toThrow(/did not return an entity list/);
  });

  it('throws when no token is configured', async () => {
    const { ctx } = makeCtx(async () => new Response('[]', { status: 200 }));
    await expect(
      fetcher()(ctx, { type: 'home-assistant', url: 'http://ha.local:8123', entities: ['light.kitchen'] }),
    ).rejects.toThrow(/HA_TOKEN/);
  });

  it('words a binary sensor by device class instead of showing on/off', async () => {
    const data = await fetchWith(['binary_sensor.front_door', 'binary_sensor.garage_door']);
    expect(data.entities[0]).toMatchObject({ name: 'Front Door', value: 'Closed', status: 'positive' });
    expect(data.entities[1]).toMatchObject({ value: 'Open', status: 'negative' });
  });

  it('falls back to on/off for a binary sensor with no opening class', async () => {
    const data = await fetchWith(['binary_sensor.hall_motion']);
    expect(data.entities[0]).toMatchObject({
      name: 'Hall Motion',
      value: 'On',
      status: 'positive',
      raw: 'on',
    });
  });

  it('reads a lock as locked/unlocked, unlocked being negative', async () => {
    const data = await fetchWith(['lock.front']);
    expect(data.entities[0]).toMatchObject({ value: 'Unlocked', status: 'negative' });
  });

  it('suffixes a sensor with its unit and marks it numeric', async () => {
    const data = await fetchWith(['sensor.living_room_temp']);
    expect(data.entities[0]).toMatchObject({
      value: '21.5 °C',
      raw: '21.5',
      numeric: true,
      status: 'neutral',
    });
  });

  it('keeps an unavailable state as-is and does not append a unit', async () => {
    const data = await fetchWith(['sensor.lamp_watts']);
    expect(data.entities[0]).toMatchObject({ value: 'unknown', numeric: false, status: 'neutral' });
  });

  it('marks a configured entity the install does not know as unavailable', async () => {
    const data = await fetchWith(['sensor.not_installed']);
    expect(data.entities[0]).toMatchObject({ name: 'Not Installed', value: 'unavailable', raw: '' });
  });

  it('lets a config label win over the install friendly name', async () => {
    const data = await fetchWith([{ entity: 'sensor.living_room_temp', label: 'Lounge' }]);
    expect(data.entities[0].name).toBe('Lounge');
    expect(data.entities[0].id).toBe('sensor.living_room_temp');
  });
});
