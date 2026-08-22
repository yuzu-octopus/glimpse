import type { WidgetFetchContext } from './registry';

export interface HttpOptions extends Omit<RequestInit, 'signal'> {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  factor?: number;
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
  retryOpts: RetryOptions = { retries: 3, baseDelay: 500, factor: 2 },
): Promise<Response> {
  const retries = retryOpts.retries ?? 3;
  const baseDelay = retryOpts.baseDelay ?? 500;
  const factor = retryOpts.factor ?? 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response | undefined;
    try {
      const { timeoutMs, ...rest } = httpOpts;
      res = await ctx.fetch(url, {
        ...rest,
        headers: httpOpts.headers,
        signal: AbortSignal.timeout(timeoutMs ?? 15_000),
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
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    if (attempt === retries) {
      throw new Error(`HTTP ${res.status} for ${url}`);
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
  throw new Error(`HTTP fetch failed for ${url}`);
}

/** JSON GET helper — every fetcher goes through ctx.fetch (injectable). */
export async function fetchJson<T>(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
): Promise<T> {
  const res = await fetchWithRetry(ctx, url, opts);
  return res.json() as Promise<T>;
}

export async function fetchText(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
): Promise<string> {
  const res = await fetchWithRetry(ctx, url, opts);
  return res.text();
}
