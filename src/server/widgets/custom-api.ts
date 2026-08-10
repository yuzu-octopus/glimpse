import { JSONPath } from 'jsonpath-plus';
import { customApiSchema } from '../../shared/widgets/keyed';
import { registerWidget } from './registry';

export interface CustomApiItem {
  title: string;
  url: string | null;
  description: string | null;
  icon: string | null;
  subtitle: string | null;
  value: string | null;
  image: string | null;
  timestamp: string | null;
}

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

  const headers: Record<string, string> = { ...cfg.headers };
  const method = cfg.method ?? 'GET';
  if (cfg['body-type'] === 'json' && !('content-type' in headers)) {
    headers['content-type'] = 'application/json';
  }

  const url = new URL(cfg.url);
  for (const [k, v] of Object.entries(cfg.parameters ?? {})) {
    url.searchParams.set(k, v);
  }

  const init: RequestInit = { method, headers };
  if (cfg.body !== undefined) init.body = cfg.body;
  const res = await ctx.fetch(url.toString(), init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const payload = (await res.json()) as unknown;

  const rootResult = JSONPath({ path: cfg.options.path, json: payload as object }) as unknown;
  const list: unknown[] = Array.isArray(rootResult) ? rootResult : [rootResult];

  const items: CustomApiItem[] = list.map((item) => {
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
      const value = evalFirst(expr, item);
      if (key === 'title') mapped.title = value ?? '';
      else mapped[key] = value;
    }
    return mapped;
  });

  return { items, frameless: cfg.frameless ?? false };
});
