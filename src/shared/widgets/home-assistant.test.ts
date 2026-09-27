import { describe, expect, it } from 'vitest';
import { homeAssistantSchema } from './home-assistant';

describe('home-assistant schema', () => {
  it('accepts a bare entity-id list and defaults the url', () => {
    const cfg = homeAssistantSchema.parse({
      type: 'home-assistant',
      entities: ['binary_sensor.front_door', 'sensor.living_room_temp'],
    });
    expect(cfg.url).toBe('http://homeassistant.local:8123');
    expect(cfg.entities).toHaveLength(2);
  });

  it('keeps a per-entity label override', () => {
    const cfg = homeAssistantSchema.parse({
      type: 'home-assistant',
      url: 'https://ha.example',
      entities: ['binary_sensor.front_door', { entity: 'sensor.living_room_temp', label: 'Lounge' }],
    });
    expect(cfg.entities[1]).toEqual({ entity: 'sensor.living_room_temp', label: 'Lounge' });
  });

  it('rejects an empty entity list', () => {
    expect(() => homeAssistantSchema.parse({ type: 'home-assistant', entities: [] })).toThrow();
  });

  it('rejects an entry with a blank entity id', () => {
    expect(() =>
      homeAssistantSchema.parse({ type: 'home-assistant', entities: [{ entity: '' }] }),
    ).toThrow();
  });
});
