import type { WidgetFetchContext } from './registry';
import { SHARED_WIDGET_DEFAULTS } from '../../shared/widgets/shared';

/** Retry budget when a widget sets none. Mirrors the shared `retries`
 * default, so config and fetcher can never disagree. */
export const DEFAULT_RETRIES: number = SHARED_WIDGET_DEFAULTS.retries;
const DEFAULT_BASE_DELAY = 500;
const DEFAULT_FACTOR = 2;

export interface HttpOptions extends Omit<RequestInit, 'signal'> {
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** A leading `user:pass@`, with or without the scheme in front of it. */
const USERINFO = /^(?:[a-z][a-z\d+.-]*:\/\/)?[^/@]*@/i;

/** Strip credentials and query values so a URL is safe to embed in a thrown
 * error — those messages reach the browser, the page cache and the service
 * worker's Cache Storage, and are rendered by WidgetChrome (see AGENTS.md).
 * Keeps what a human needs to diagnose: scheme, host, port, path, plus a `?…`
 * marker for the query. Exported because widget fetchers that throw their own
 * errors must sanitize too; fetchWithRetry can only sanitize what it throws
 * itself.
 *
 * `URL.origin` is scheme+host+port only, so it already drops `user:pass@` —
 * but it is the string "null" for non-special schemes, where the credential
 * lands in `pathname` instead. USERINFO is applied to the rendered head either
 * way, so neither shape can print a secret. */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const head = u.origin === 'null' ? `${u.protocol}//${u.host}${u.pathname}` : `${u.origin}${u.pathname}`;
    return `${head.replace(USERINFO, '')}${u.search ? '?…' : ''}`;
  } catch {
    const q = url.indexOf('?');
    const head = q === -1 ? url : url.slice(0, q);
    return `${head.replace(USERINFO, '')}${q === -1 ? '' : '?…'}`;
  }
}

export interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  factor?: number;
}

/** Read the retry budget off a validated widget config. Missing or malformed
 * values fall back to the default, so a config written before the field
 * existed keeps today's behaviour. */
export function retryOptionsFrom(
  config: Record<string, unknown> | undefined,
): RetryOptions {
  const raw = config?.['retries'];
  return {
    retries:
      typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
        ? raw
        : DEFAULT_RETRIES,
  };
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // numeric seconds (allow decimal)
  const secs = Number(trimmed);
  if (!Number.isNaN(secs) && /^[\d.]+$/.test(trimmed)) {
    return secs * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

const RETRYABLE: Record<number, true> = {
  403: true,
  429: true,
  500: true,
  502: true,
  503: true,
  504: true,
};

export async function fetchWithRetry(
  ctx: WidgetFetchContext,
  url: string,
  httpOpts: HttpOptions = {},
  retryOpts: RetryOptions = {},
): Promise<Response> {
  const retries = retryOpts.retries ?? DEFAULT_RETRIES;
  const baseDelay = retryOpts.baseDelay ?? DEFAULT_BASE_DELAY;
  const factor = retryOpts.factor ?? DEFAULT_FACTOR;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response | undefined;
    try {
      const { timeoutMs, signal: outerSignal, ...rest } = httpOpts;
      const timeoutSignal = AbortSignal.timeout(timeoutMs ?? 15_000);
      const signal = outerSignal
        ? (typeof AbortSignal.any === 'function'
            ? AbortSignal.any([outerSignal, timeoutSignal])
            : outerSignal.aborted
              ? outerSignal
              : timeoutSignal.aborted
                ? timeoutSignal
                : (() => {
                    const ac = new AbortController();
                    const onAbort = (): void => ac.abort((outerSignal as unknown as { reason?: unknown }).reason ?? timeoutSignal.reason);
                    outerSignal.addEventListener('abort', onAbort, { once: true });
                    timeoutSignal.addEventListener('abort', onAbort, { once: true });
                    return ac.signal;
                  })())
        : timeoutSignal;
      res = await ctx.fetch(url, {
        ...rest,
        headers: httpOpts.headers,
        signal,
      } as RequestInit & { proxy?: string });
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelay * Math.pow(factor, attempt) + Math.random() * 100;
      {
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, delay);
        await promise;
      }
      continue;
    }

    if (res.ok) return res;

    if (!RETRYABLE[res.status]) {
      throw new Error(`HTTP ${res.status} for ${sanitizeUrl(url)}`);
    }

    if (attempt === retries) {
      throw new Error(`HTTP ${res.status} for ${sanitizeUrl(url)}`);
    }

    let delay = baseDelay * Math.pow(factor, attempt) + Math.random() * 100;
    const ra = res.headers.get('Retry-After');
    const raMs = parseRetryAfter(ra);
    if (raMs !== null) {
      delay = Math.max(delay, raMs);
    }
    {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, delay);
      await promise;
    }
  }
  // unreachable
  throw new Error(`HTTP fetch failed for ${sanitizeUrl(url)}`);
}

/** JSON GET helper — every widget fetcher goes through ctx.fetch (injectable).
 * `retryOpts` carries the widget's configured `retries` budget. */
export async function fetchJson<T>(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
  retryOpts?: RetryOptions,
): Promise<T> {
  const res = await fetchWithRetry(ctx, url, opts, retryOpts);
  return res.json() as Promise<T>;
}

export async function fetchText(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
  retryOpts?: RetryOptions,
): Promise<string> {
  const res = await fetchWithRetry(ctx, url, opts, retryOpts);
  return res.text();
}
