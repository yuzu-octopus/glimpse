import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import {
  fetchWithRetry,
  fetchJson,
  fetchText,
  retryOptionsFrom,
  sanitizeUrl,
  DEFAULT_RETRIES,
} from './http';
import type { WidgetFetchContext } from './registry';

function makeCtx(fetchMock: ReturnType<typeof vi.fn>): WidgetFetchContext {
  return {
    fetch: fetchMock as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

describe('fetchWithRetry', () => {
  let originalRandom: () => number;

  beforeEach(() => {
    originalRandom = Math.random;
    Math.random = () => 0;
  });

  afterEach(() => {
    Math.random = originalRandom;
    vi.restoreAllMocks();
  });

  it('retries 403 twice then succeeds (3 calls)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 403 }))
      .mockResolvedValueOnce(new Response('x', { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const ctx = makeCtx(fetchMock);
    const res = await fetchWithRetry(ctx, 'https://example.com/a', {}, { retries: 3, baseDelay: 1, factor: 2 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // fetchJson delegates to fetchWithRetry — verify single success path fast
    const fetchMock2 = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const ctx2 = makeCtx(fetchMock2);
    const data = await fetchJson<{ ok: boolean }>(ctx2, 'https://example.com/b');
    expect(data).toEqual({ ok: true });
    expect(fetchMock2).toHaveBeenCalledTimes(1);
  });

  it('respects Retry-After header (seconds)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 429, headers: { 'Retry-After': '0.05' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const ctx = makeCtx(fetchMock);
    const start = Date.now();
    const res = await fetchWithRetry(ctx, 'https://example.com/b', {}, { retries: 3, baseDelay: 1, factor: 2 });
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 0.05s = 50ms, baseDelay 1ms, so elapsed should be at least ~40ms
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('respects Retry-After http-date', async () => {
    const future = new Date(Date.now() + 2000).toUTCString();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 503, headers: { 'Retry-After': future } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const ctx = makeCtx(fetchMock);
    const start = Date.now();
    const res = await fetchWithRetry(ctx, 'https://example.com/c', {}, { retries: 3, baseDelay: 1, factor: 2 });
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it('non-retry status throws immediately without retry', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    const ctx = makeCtx(fetchMock);
    await expect(fetchWithRetry(ctx, 'https://example.com/d', {}, { retries: 3, baseDelay: 1, factor: 2 })).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('network error retries then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const ctx = makeCtx(fetchMock);
    const res = await fetchWithRetry(ctx, 'https://example.com/e', {}, { retries: 3, baseDelay: 1, factor: 2 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetchText delegates to fetchWithRetry', async () => {
    const fetchMock = vi.fn(async () => new Response('hello', { status: 200 }));
    const ctx = makeCtx(fetchMock);
    const text = await fetchText(ctx, 'https://example.com/f');
    expect(text).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries: 0 means exactly one attempt', async () => {
    const fetchMock = vi.fn(async () => new Response('x', { status: 500 }));
    const ctx = makeCtx(fetchMock);
    await expect(
      fetchWithRetry(ctx, 'https://example.com/zero', {}, { retries: 0 }),
    ).rejects.toThrow('HTTP 500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries: 2 means up to three attempts', async () => {
    const fetchMock = vi.fn(async () => new Response('x', { status: 503 }));
    const ctx = makeCtx(fetchMock);
    await expect(
      fetchWithRetry(ctx, 'https://example.com/two', {}, { retries: 2, baseDelay: 1 }),
    ).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries: 0 also gives a network error a single attempt', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    const ctx = makeCtx(fetchMock);
    await expect(
      fetchWithRetry(ctx, 'https://example.com/netzero', {}, { retries: 0 }),
    ).rejects.toThrow('network down');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('defaults to the shared retry budget when config sets none', async () => {
    const fetchMock = vi.fn(async () => new Response('x', { status: 500 }));
    const ctx = makeCtx(fetchMock);
    await expect(
      fetchWithRetry(ctx, 'https://example.com/def', {}, { ...retryOptionsFrom({}), baseDelay: 1 }),
    ).rejects.toThrow('HTTP 500');
    // one initial attempt plus the default budget
    expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_RETRIES + 1);
  });
});

describe('retryOptionsFrom', () => {
  it('reads an explicit budget off the widget config', () => {
    expect(retryOptionsFrom({ retries: 0 })).toEqual({ retries: 0 });
    expect(retryOptionsFrom({ retries: 2 })).toEqual({ retries: 2 });
  });

  it('falls back to the default for missing or malformed budgets', () => {
    expect(retryOptionsFrom(undefined)).toEqual({ retries: DEFAULT_RETRIES });
    expect(retryOptionsFrom({})).toEqual({ retries: DEFAULT_RETRIES });
    expect(retryOptionsFrom({ retries: 'three' })).toEqual({ retries: DEFAULT_RETRIES });
    expect(retryOptionsFrom({ retries: 1.5 })).toEqual({ retries: DEFAULT_RETRIES });
    expect(retryOptionsFrom({ retries: -1 })).toEqual({ retries: DEFAULT_RETRIES });
  });

  it('carries the budget through fetchJson', async () => {
    const fetchMock = vi.fn(async () => new Response('x', { status: 500 }));
    const ctx = makeCtx(fetchMock);
    await expect(
      fetchJson(ctx, 'https://example.com/json', {}, retryOptionsFrom({ retries: 0 })),
    ).rejects.toThrow('HTTP 500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('sanitizeUrl', () => {
  it('drops the query string but keeps the host, port and path', () => {
    expect(sanitizeUrl('https://api.example.com:8443/v1/items?token=secret123&page=2')).toBe(
      'https://api.example.com:8443/v1/items?…',
    );
  });

  it('drops userinfo credentials', () => {
    expect(sanitizeUrl('http://admin:hunter2@dns.local:3000/control/stats?auth=tok')).toBe(
      'http://dns.local:3000/control/stats?…',
    );
  });

  it('leaves a secret-free URL intact', () => {
    expect(sanitizeUrl('https://api.github.com/repos/astryx/glimpse/commits')).toBe(
      'https://api.github.com/repos/astryx/glimpse/commits',
    );
  });

  it('still strips credentials and query from an unparseable URL', () => {
    expect(sanitizeUrl('admin:hunter2@dns.local/api?token=secret123')).toBe('dns.local/api?…');
    expect(sanitizeUrl('not a url at all')).toBe('not a url at all');
  });

  it('never returns a null origin', () => {
    expect(sanitizeUrl('file:///etc/hosts')).not.toContain('null');
  });
});
