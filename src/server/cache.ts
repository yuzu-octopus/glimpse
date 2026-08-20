/**
 * In-memory TTL cache + singleflight dedupe, mirroring glance's per-widget
 * cache prop and internal/singleflight.go. Widgets share one instance.
 */

export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Drop every entry (config reload: keys are slug:path, no longer trustworthy). */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Live widgets need short TTL so data stays fresh without hammering
 * backends; everything else is effectively static and reload-only.
 * Mirrors glance's per-widget cache defaults (weather ≈ 1h there, but
 * we front it with a 60s server TTL + 30s client poll for liveness).
 */
export const LIVE_TYPES = new Set(['clock', 'weather', 'markets', 'monitor']);

export function getDefaultTtl(type: string): number {
  return LIVE_TYPES.has(type) ? 60_000 : 3_600_000;
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
