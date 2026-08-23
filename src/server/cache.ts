import { LIVE_TTL_MS, LIVE_TYPES, STATIC_TTL_MS } from '../shared/live';

/**
 * In-memory TTL cache + singleflight dedupe, mirroring glance's per-widget
 * cache prop and internal/singleflight.go. Widgets share one instance.
 * Supports stale-while-revalidate retain (24h).
 */

export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private staleStore = new Map<string, { value: unknown; staleUntil: number }>();
  private ops = 0;

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
    this.ops += 1;
    if (this.ops % 128 === 0) this.sweep();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.store) if (v.expiresAt <= now) this.store.delete(k);
    for (const [k, v] of this.staleStore) if (v.staleUntil <= now) this.staleStore.delete(k);
  }

  /** Drop every entry (config reload: keys are slug:path, no longer trustworthy). */
  clear(): void {
    this.store.clear();
    this.staleStore.clear();
  }

  /** Delete entries whose key starts with prefix (granular slug clear). */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.staleStore.keys()) {
      if (key.startsWith(prefix)) this.staleStore.delete(key);
    }
  }
}


export function getDefaultTtl(type: string): number {
  if (type === "server-stats" || type === "system-stats") return 1_000;
  return LIVE_TYPES[type] ? LIVE_TTL_MS : STATIC_TTL_MS;
}

/**
 * Parse glance's cache duration syntax ("12h", "1d", "30m", "45s").
 * Default 5 minutes when absent/invalid.
 */
export function parseCacheDuration(value: string | undefined, fallbackMs = 300_000): number {
  if (!value) return fallbackMs;
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return fallbackMs;
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
    let promise: Promise<T>;
    try {
      promise = Promise.resolve(fn()).finally(() => {
        this.inflight.delete(key);
      });
    } catch (e) {
      return Promise.reject(e);
    }
    this.inflight.set(key, promise);
    return promise;
  }
}
