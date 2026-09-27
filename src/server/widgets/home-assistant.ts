import { homeAssistantSchema } from '../../shared/widgets/home-assistant';
import type { HomeAssistantData, HomeAssistantEntity, HomeAssistantStatus } from '../../shared/widgets/payloads';
import { fetchJson, retryOptionsFrom } from './http';
import { registerWidget } from './registry';

/** The shape `GET /api/states` returns per entity. Only the four fields this
 *  widget reads are typed; the rest of the object rides along untouched. */
interface HaState {
  entity_id: string;
  state: string;
  attributes?: {
    friendly_name?: string;
    unit_of_measurement?: string;
    device_class?: string;
  };
}

/** Device classes whose active state means "not what you want to see". Every
 *  other binary domain falls back to on/off, where `on` is just active. */
const OPENING_CLASSES: Record<string, true> = {
  door: true,
  window: true,
  garage_door: true,
  opening: true,
  lock: true,
  safety: true,
  problem: true,
  smoke: true,
  gas: true,
  moisture: true,
  tamper: true,
};

/** Domains that answer with a word rather than the raw state. Deliberately a
 *  short list — HA has ~20 domains, and a config that wants a different word
 *  sets `label` on its entry instead of growing this table. */
const BINARY_DOMAINS: Record<string, true> = {
  binary_sensor: true,
  light: true,
  switch: true,
  fan: true,
  input_boolean: true,
  lock: true,
};

interface Entry {
  id: string;
  label?: string;
}

/** Resolve one binary state to a word plus how it should read. Returns null
 *  for anything that is not an on/off pair, so the caller keeps the raw state. */
function binaryWord(
  state: string,
  domain: string,
  deviceClass: string,
): { value: string; status: HomeAssistantStatus } | null {
  const active = state === 'on' || state === 'true' || state === 'open' || state === 'unlocked';
  const inactive = state === 'off' || state === 'false' || state === 'closed' || state === 'locked';
  if (!active && !inactive) return null;

  if (domain === 'lock') {
    return active
      ? { value: 'Locked', status: 'positive' }
      : { value: 'Unlocked', status: 'negative' };
  }
  if (OPENING_CLASSES[deviceClass]) {
    return active
      ? { value: 'Open', status: 'negative' }
      : { value: 'Closed', status: 'positive' };
  }
  return { value: active ? 'On' : 'Off', status: active ? 'positive' : 'neutral' };
}

function toEntity(entry: Entry, found: HaState | undefined): HomeAssistantEntity {
  const id = entry.id;
  const domain = id.includes('.') ? id.slice(0, id.indexOf('.')) : id;
  // An explicit config label wins over the install's own friendly name, which
  // wins over the id with the domain stripped (`sensor.living_room_temp` →
  // `Living Room Temp`).
  const object = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;
  const derived = object.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const name = entry.label || found?.attributes?.friendly_name || derived;

  // A configured entity the install does not know is a typo or a removed
  // entity. Show it as unavailable rather than dropping the row silently.
  if (!found) {
    return { id, name, domain, raw: '', value: 'unavailable', status: 'neutral', numeric: false };
  }

  const raw = found.state;
  if (raw === '' || raw === 'unknown' || raw === 'unavailable') {
    return { id, name, domain, raw, value: raw || 'unavailable', status: 'neutral', numeric: false };
  }

  if (BINARY_DOMAINS[domain]) {
    const word = binaryWord(raw, domain, found.attributes?.device_class ?? '');
    if (word) return { id, name, domain, raw, value: word.value, status: word.status, numeric: false };
  }

  const unit = found.attributes?.unit_of_measurement;
  return {
    id,
    name,
    domain,
    raw,
    value: unit ? `${raw} ${unit}` : raw,
    status: 'neutral',
    numeric: /^-?\d/.test(raw),
  };
}

registerWidget('home-assistant', async (ctx, config): Promise<HomeAssistantData> => {
  const cfg = homeAssistantSchema.parse(config);
  const token = cfg.token ?? ctx.env.HA_TOKEN;
  if (!token) throw new Error('home-assistant: missing token (set token or HA_TOKEN)');
  const base = cfg.url.replace(/\/+$/, '');

  // One call returns every entity in the install, so the config's list is a
  // filter over this response — never N requests.
  const states = await fetchJson<HaState[]>(
    ctx,
    `${base}/api/states`,
    { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
    retryOptionsFrom(cfg),
  );

  if (!Array.isArray(states)) {
    throw new Error('home-assistant: /api/states did not return an entity list');
  }

  const byId = new Map(states.map((s) => [s.entity_id, s]));
  return {
    entities: cfg.entities.map((raw) => {
      const entry = typeof raw === 'string' ? { id: raw } : { id: raw.entity, label: raw.label };
      return toEntity(entry, byId.get(entry.id));
    }),
  };
});
