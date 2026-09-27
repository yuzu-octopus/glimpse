import { JSONPath } from 'jsonpath-plus';
import { CUSTOM_API_DEFAULTS, customApiSchema } from '../../shared/widgets/keyed';
import { fetchWithRetry, retryOptionsFrom, type HttpOptions, type RetryOptions } from './http';
import { registerWidget, type WidgetFetchContext } from './registry';
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

/** One custom-api request: the widget body, or one entry of `subrequests`.
 * Owns the insecure-http guard, the default headers, query parameters and
 * the JSON / JSON Lines body handling, so a subrequest supports exactly
 * what the top level does. */
async function fetchJsonPayload(
  ctx: WidgetFetchContext,
  req: {
    url: string;
    headers?: Record<string, string>;
    method?: string;
    body?: unknown;
    'body-type'?: 'json' | 'string';
    parameters?: Record<string, string | string[]>;
    'allow-insecure'?: boolean;
    'skip-json-validation'?: boolean;
  },
  retries: RetryOptions,
): Promise<unknown> {
  if (req.url.startsWith('http://') && !req['allow-insecure']) {
    throw new Error(
      'custom-api: refusing insecure http:// URL; set allow-insecure: true to permit it',
    );
  }

  const headers: Record<string, string> = { ...req.headers };
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'user-agent')) headers['User-Agent'] = 'glimpse/0.1 (https://github.com/glanceapp/glance)';
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept')) headers['Accept'] = 'application/json';
  const method = req.method ?? 'GET';
  // Glance sends JSON bodies when body-type is json; a map body implies json
  // even when body-type is absent (glance default with a map body).
  const bodyIsMap = req.body !== undefined && typeof req.body !== 'string';
  if ((req['body-type'] === 'json' || bodyIsMap) && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
    headers['content-type'] = 'application/json';
  }

  const url = new URL(req.url);
  for (const [k, v] of Object.entries(req.parameters ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }

  const body = req.body !== undefined ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined;
  const res = await fetchWithRetry(
    ctx,
    url.toString(),
    { method, headers, body } as unknown as HttpOptions & { proxy?: string },
    retries,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  // skip-json-validation tolerates JSON Lines responses: each non-empty line
  // parses into one array element. A single JSON document still parses as-is
  // (a bare object is later wrapped into a one-item list).
  if (req['skip-json-validation']) {
    const text = await res.text();
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not a single JSON document — treat as JSON Lines, one item per line.
      return trimmed
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
    }
  }
  return res.json();
}

registerWidget('custom-api', async (ctx, config) => {
  const cfg = customApiSchema.parse(config);
  const retries = retryOptionsFrom(cfg);

  // With no url, the subrequest payloads become a synthetic root keyed by
  // name, so the existing JSONPath mapping reaches them the way glance's
  // .Subrequest("key") does — $.another-one.text — with no new template
  // language. When a url IS set its payload is the root and the subrequests
  // are not merged in: that would be unreachable for an array-root payload.
  let payload: unknown;
  if (cfg.url !== undefined) {
    payload = await fetchJsonPayload(ctx, { ...cfg, url: cfg.url }, retries);
  } else {
    const entries = await Promise.all(
      Object.entries(cfg.subrequests ?? {}).map(async ([name, req]) => [
        name,
        await fetchJsonPayload(ctx, req, retries),
      ] as const),
    );
    payload = Object.fromEntries(entries);
  }

  const rootResult = JSONPath({ path: cfg.options.path, json: payload as object }) as unknown;
  const list: unknown[] = Array.isArray(rootResult) ? rootResult : [rootResult];

  const limit = cfg.limit ?? CUSTOM_API_DEFAULTS.limit;
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
