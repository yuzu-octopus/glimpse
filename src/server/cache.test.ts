import { describe, expect, it, vi } from 'vitest';
import { getDefaultTtl, parseCacheDuration, Singleflight, TtlCache } from './cache';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

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

  it('trims surrounding whitespace', () => {
    expect(parseCacheDuration('  12h  ')).toBe(12 * 3600 * 1000);
  });

  it('rejects a fractional amount', () => {
    expect(parseCacheDuration('1.5h')).toBe(5 * 60 * 1000);
  });

  it('falls back to the caller-supplied default', () => {
    expect(parseCacheDuration(undefined, 42)).toBe(42);
    expect(parseCacheDuration('nope', 42)).toBe(42);
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

  it('deleteByPrefix drops that slug and leaves every other slug intact', () => {
    const cache = new TtlCache();
    cache.set('home:widgets:0', 'h', 60_000);
    cache.set('home:widgets:1', 'h2', 60_000);
    cache.set('lab:widgets:0', 'l', 60_000);
    cache.set('home-staging:widgets:0', 'other', 60_000);
    cache.deleteByPrefix('home:');
    expect(cache.get('home:widgets:0')).toBeUndefined();
    expect(cache.get('home:widgets:1')).toBeUndefined();
    expect(cache.get('lab:widgets:0')).toBe('l');
    // A longer slug that merely starts with the same letters is a different
    // slug, not a victim of the prefix delete.
    expect(cache.get('home-staging:widgets:0')).toBe('other');
  });

  it('deleteByPrefix also drops the retained stale copy', () => {
    // `?force=1` clears the slug prefix so an explicit reload is guaranteed to
    // reach upstream. Clearing only the fresh map would leave the stale copy
    // behind, and a failing fetch would then serve the very value the reload
    // was meant to replace.
    vi.useFakeTimers();
    const cache = new TtlCache();
    cache.set('home:widgets:0', 'old', 10);
    vi.advanceTimersByTime(20);
    expect(cache.get('home:widgets:0')).toBeUndefined();
    expect(cache.getStale('home:widgets:0')).toBe('old');
    cache.deleteByPrefix('home:');
    expect(cache.getStale('home:widgets:0')).toBeUndefined();
    vi.useRealTimers();
  });
});

// stale-on-error is the reason there are two maps: a widget whose upstream is
// down keeps rendering its last good data for a day instead of flipping to an
// error banner and back, once per poll.
describe('TtlCache stale retention', () => {
  it('serves the last good value after the fresh TTL has expired', () => {
    vi.useFakeTimers();
    const cache = new TtlCache();
    cache.set('k', 'good', 60_000);
    vi.advanceTimersByTime(60_001);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.getStale('k')).toBe('good');
    vi.useRealTimers();
  });

  it('serves the fresh value through getStale too', () => {
    const cache = new TtlCache();
    cache.set('k', 'good', 60_000);
    expect(cache.getStale('k')).toBe('good');
  });

  it('drops the retained copy once the 24h retain window has passed', () => {
    vi.useFakeTimers();
    const cache = new TtlCache();
    cache.set('k', 'good', 60_000);
    vi.advanceTimersByTime(DAY + 60_000);
    expect(cache.getStale('k')).toBeUndefined();
    vi.useRealTimers();
  });

  it('a later successful set replaces the retained value, not just the fresh one', () => {
    // Two successful fetches an hour apart: the second is the value a later
    // stale-on-error must serve, not the first one's.
    vi.useFakeTimers();
    const cache = new TtlCache();
    cache.set('k', 'first', 60_000);
    vi.advanceTimersByTime(HOUR);
    cache.set('k', 'second', 60_000);
    vi.advanceTimersByTime(60_001);
    expect(cache.getStale('k')).toBe('second');
    vi.useRealTimers();
  });

  it('getStale on a key that was never set is undefined', () => {
    expect(new TtlCache().getStale('nope')).toBeUndefined();
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
  it('gives the 1s host-metric widgets a 1s TTL', () => {
    expect(getDefaultTtl('server-stats')).toBe(1_000);
    expect(getDefaultTtl('system-stats')).toBe(1_000);
  });
  it('gives weather-radar a 10min TTL', () => {
    // RainViewer publishes a new frame every ~10min; polling faster only burns
    // quota to redraw the same image.
    expect(getDefaultTtl('weather-radar')).toBe(600_000);
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

  it('does not collapse two different keys onto one flight', async () => {
    // The same widget type on two pages has two cache keys. If dedupe ignored
    // the key, one page would render the other page's data.
    const sf = new Singleflight();
    const a = vi.fn(async () => 'home');
    const b = vi.fn(async () => 'lab');
    const [x, y] = await Promise.all([sf.run('home:0', a), sf.run('lab:0', b)]);
    expect(x).toBe('home');
    expect(y).toBe('lab');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('shares the rejection with every concurrent caller', async () => {
    const sf = new Singleflight();
    const fn = vi.fn(async () => {
      throw new Error('upstream 500');
    });
    const settled = Promise.allSettled([sf.run('k', fn), sf.run('k', fn)]);
    const results = await settled;
    expect(fn).toHaveBeenCalledOnce();
    for (const r of results) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') expect((r.reason as Error).message).toBe('upstream 500');
    }
  });

  it('a rejected flight does not poison the key', async () => {
    // The in-flight entry is removed on settle, not only on success. A poisoned
    // key would re-reject forever and the widget would never recover, however
    // many times the upstream came back.
    const sf = new Singleflight();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');
    await expect(sf.run('k', fn)).rejects.toThrow('boom');
    await expect(sf.run('k', fn)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a synchronously throwing fn becomes a rejected promise, not a sync throw', async () => {
    // Callers wire `run()` into an async pipeline, not a try/catch around the
    // call. A fn that throws before its first await must still surface through
    // the promise or it escapes as an unhandled throw.
    const sf = new Singleflight();
    const p = sf.run('k', () => {
      throw new Error('sync boom');
    });
    expect(p).toBeInstanceOf(Promise);
    await expect(p).rejects.toThrow('sync boom');
    // The key was never registered, so the next call must actually run.
    const fn = vi.fn(async () => 'ok');
    await expect(sf.run('k', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });
});
