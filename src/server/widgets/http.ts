import type { WidgetFetchContext } from './registry';

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** JSON GET helper — every fetcher goes through ctx.fetch (injectable). */
export async function fetchJson<T>(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
): Promise<T> {
  const res = await ctx.fetch(url, {
    headers: opts.headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export async function fetchText(
  ctx: WidgetFetchContext,
  url: string,
  opts: HttpOptions = {},
): Promise<string> {
  const res = await ctx.fetch(url, {
    headers: opts.headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
