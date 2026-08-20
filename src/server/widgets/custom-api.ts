import { JSONPath } from 'jsonpath-plus';
import { customApiSchema } from '../../shared/widgets/keyed';
import { registerWidget } from './registry';
import type { CustomApiItem } from '../../shared/widgets/payloads';

const FIELD_KEYS = [
  'title',
  'url',
  'description',
  'icon',
  'subtitle',
  'value',
  'image',
  'timestamp',
] as const;

/** First JSONPath result stringified; null when absent or empty. */
function evalFirst(expr: string, json: unknown): string | null {
  const results = JSONPath({ path: expr, json: json as object }) as unknown;
  const first = Array.isArray(results) ? results[0] : results;
  if (first === undefined || first === null) return null;
  const s = String(first);
  return s === '' ? null : s;
}

registerWidget('custom-api', async (ctx, config) => {
  const cfg = customApiSchema.parse(config);

  if (cfg.url.startsWith('http://') && !cfg['allow-insecure']) {
    throw new Error(
      'custom-api: refusing insecure http:// URL; set allow-insecure: true to permit it',
    );
  }

  const headers: Record<string, string> = { ...cfg.headers };
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'user-agent')) headers['User-Agent'] = 'glimpse/0.1 (https://github.com/glanceapp/glance)';
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept')) headers['Accept'] = 'application/json';
  const method = cfg.method ?? 'GET';
  // Glance sends JSON bodies when body-type is json; a map body implies json
  // even when body-type is absent (glance default with a map body).
  const bodyIsMap = cfg.body !== undefined && typeof cfg.body !== 'string';
  if ((cfg['body-type'] === 'json' || bodyIsMap) && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['content-type'] = 'application/json';
  }

  const url = new URL(cfg.url);
  for (const [k, v] of Object.entries(cfg.parameters ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }

  const init: RequestInit = { method, headers };
  if (cfg.body !== undefined) {
    init.body =
      typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body);
  }
  const res = await ctx.fetch(url.toString(), init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  // skip-json-validation tolerates JSON Lines responses: each non-empty line
  // parses into one array element. A single JSON document still parses as-is
  // (a bare object is later wrapped into a one-item list).
  let payload: unknown;
  if (cfg['skip-json-validation']) {
    const text = await res.text();
    const trimmed = text.trim();
    try {
      payload = JSON.parse(trimmed);
    } catch {
      // Not a single JSON document — treat as JSON Lines, one item per line.
      payload = trimmed
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
    }
  } else {
    payload = await res.json();
  }

  const rootResult = JSONPath({ path: cfg.options.path, json: payload as object }) as unknown;
  const list: unknown[] = Array.isArray(rootResult) ? rootResult : [rootResult];

  const limit = cfg.limit ?? 5;
  const sliced = list.slice(0, limit);
  const items: CustomApiItem[] = sliced.map((item) => {
    const mapped: CustomApiItem = {
      title: '',
      url: null,
      description: null,
      icon: null,
      subtitle: null,
      value: null,
      image: null,
      timestamp: null,
    };
    for (const key of FIELD_KEYS) {
      const expr = cfg.options[key];
      if (!expr) continue;
      const isJsonPath = expr.startsWith('$') || expr.startsWith('@');
      const value = isJsonPath ? evalFirst(expr, item) : expr;
      if (key === 'title') mapped.title = value ?? '';
      else mapped[key] = value;
    }
    if (item !== null && typeof item !== 'object') {
      const scalar = String(item);
      if (scalar !== '' && mapped.value === null) mapped.value = scalar;
      if (mapped.title === '') mapped.title = scalar;
    }
    return mapped;
  });
  return { items, frameless: cfg.frameless ?? false };
});
