import { LIVE_TTL_MS, LIVE_TYPES, STATIC_TTL_MS } from '../shared/live';

/**
 * In-memory TTL cache + singleflight dedupe, mirroring glance's per-widget
 * cache prop and internal/singleflight.go. Widgets share one instance.
 * Supports stale-while-revalidate retain + negative cache (30s).
 */

export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private staleStore = new Map<string, { value: unknown; staleUntil: number }>();
  private negative = new Map<string, { error: unknown; expiresAt: number }>();

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  /** Stale fallback: returns last successful value even after fresh TTL expiry (24h retain). */
  getStale<T>(key: string): T | undefined {
    // fresh hit also counts as stale hit
    const fresh = this.store.get(key);
    if (fresh && fresh.expiresAt > Date.now()) return fresh.value as T;
    const hit = this.staleStore.get(key);
    if (!hit) return undefined;
    if (hit.staleUntil <= Date.now()) {
      this.staleStore.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    // retain stale for 24h beyond fresh TTL (for stale-while-revalidate fallback)
    this.staleStore.set(key, { value, staleUntil: Date.now() + ttlMs + 24 * 60 * 60 * 1000 });
  }

  /** Negative cache: remember failures for 30s to avoid hammering. */
  setError(key: string, error: unknown, ttlMs = 30_000): void {
    this.negative.set(key, { error, expiresAt: Date.now() + ttlMs });
  }

  getError(key: string): unknown | undefined {
    const hit = this.negative.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.negative.delete(key);
      return undefined;
    }
    return hit.error;
  }

  /** Drop every entry (config reload: keys are slug:path, no longer trustworthy). */
  clear(): void {
    this.store.clear();
    this.staleStore.clear();
    this.negative.clear();
  }

  /** Delete entries whose key starts with prefix (granular slug clear). */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.staleStore.keys()) {
      if (key.startsWith(prefix)) this.staleStore.delete(key);
    }
    for (const key of this.negative.keys()) {
      if (key.startsWith(prefix)) this.negative.delete(key);
    }
  }
}

export { LIVE_POLL_MS, LIVE_TYPES, LIVE_TTL_MS, STATIC_TTL_MS } from '../shared/live';

export function getDefaultTtl(type: string): number {
  return LIVE_TYPES[type] ? LIVE_TTL_MS : STATIC_TTL_MS;
}

/**
 * Parse glance's cache duration syntax ("12h", "1d", "30m", "45s").
 * Default 5 minutes when absent/invalid.
 */
export function parseCacheDuration(value: string | undefined): number {
  if (!value) return 5 * 60 * 1000;
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return 5 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit * 1000;
}
/** Deduplicates concurrent identical fetches: one in-flight promise shared. */
export class Singleflight {
  private inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
}
