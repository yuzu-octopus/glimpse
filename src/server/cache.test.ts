import { describe, expect, it, vi } from 'vitest';
import { getDefaultTtl, parseCacheDuration, Singleflight, TtlCache } from './cache';

describe('parseCacheDuration', () => {
  it.each([
    ['12h', 12 * 3600 * 1000],
    ['1d', 86400 * 1000],
    ['30m', 30 * 60 * 1000],
    ['45s', 45 * 1000],
    [undefined, 5 * 60 * 1000],
    ['garbage', 5 * 60 * 1000],
    ['', 5 * 60 * 1000],
  ])('parses %s -> %d ms', (input, expected) => {
    expect(parseCacheDuration(input)).toBe(expected);
  });
});

describe('TtlCache', () => {
  it('expires entries after their TTL', () => {
    const cache = new TtlCache();
    cache.set('k', 'v', 10);
    expect(cache.get('k')).toBe('v');
    vi.useFakeTimers();
    vi.advanceTimersByTime(20);
    expect(cache.get('k')).toBeUndefined();
    vi.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    expect(new TtlCache().get('nope')).toBeUndefined();
  });

  it('clear() drops unexpired entries (config reload resets)', () => {
    const cache = new TtlCache();
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });
});

describe('getDefaultTtl', () => {
  it('returns 60s for live widget types', () => {
    expect(getDefaultTtl('weather')).toBe(60_000);
    expect(getDefaultTtl('clock')).toBe(60_000);
    expect(getDefaultTtl('markets')).toBe(60_000);
    expect(getDefaultTtl('monitor')).toBe(60_000);
  });
  it('returns 1h for static widget types', () => {
    expect(getDefaultTtl('rss')).toBe(3_600_000);
    expect(getDefaultTtl('releases')).toBe(3_600_000);
    expect(getDefaultTtl('videos')).toBe(3_600_000);
    expect(getDefaultTtl('unknown')).toBe(3_600_000);
  });
});

describe('Singleflight', () => {
  it('shares one in-flight promise per key', async () => {
    const sf = new Singleflight();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      return calls;
    });
    const [a, b, c] = await Promise.all([
      sf.run('k', fn),
      sf.run('k', fn),
      sf.run('k', fn),
    ]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('allows a new flight after the first settles', async () => {
    const sf = new Singleflight();
    const fn = vi.fn(async () => 'ok');
    await sf.run('k', fn);
    await sf.run('k', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
