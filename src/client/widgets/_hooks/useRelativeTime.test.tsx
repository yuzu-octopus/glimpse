import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAge, useRelativeTime } from './useRelativeTime';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatAge', () => {
  it('floors fractional seconds instead of rendering raw floats', () => {
    expect(formatAge(42.738193)).toBe('42s');
    expect(formatAge(0.5)).toBe('0s');
  });

  it('clamps negative ages to zero', () => {
    expect(formatAge(-5)).toBe('0s');
  });

  it('renders minutes, hours and days at the boundaries', () => {
    expect(formatAge(59.9)).toBe('59s');
    expect(formatAge(60)).toBe('1m');
    expect(formatAge(3599.9)).toBe('59m');
    expect(formatAge(3600)).toBe('1h');
    expect(formatAge(23 * 3600 + 59 * 60 + 59.5)).toBe('23h');
    expect(formatAge(24 * 3600)).toBe('1d');
    expect(formatAge(3 * 24 * 3600 + 1234)).toBe('3d');
  });
});

describe('useRelativeTime', () => {
  const T0 = new Date('2026-08-20T12:00:00Z');

  it('advances a minute per minute of real time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result, unmount } = renderHook(() => useRelativeTime(100));
    expect(result.current).toBe('1m');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('2m');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('3m');
    unmount();
  });

  it('catches up on real time a throttled tab skipped', () => {
    // Hidden for 2h: the browser throttles the shared interval, so one tick
    // lands for two hours of clock. The age must follow the clock.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result, unmount } = renderHook(() => useRelativeTime(100));
    expect(result.current).toBe('1m');
    act(() => {
      vi.setSystemTime(+T0 + 2 * 3600 * 1000);
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2h');
    unmount();
  });

  it('reconciles the moment a hidden tab comes back', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result, unmount } = renderHook(() => useRelativeTime(100));
    act(() => {
      vi.setSystemTime(+T0 + 2 * 3600 * 1000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2h');
    unmount();
  });

  it('does not age on ticks that passed no real time', () => {
    // The reverse: a burst of ticks with a clock that never moved is not two
    // hours of ageing, however many of them there were.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result, unmount } = renderHook(() => useRelativeTime(100));
    act(() => {
      vi.advanceTimersByTime(600_000);
      vi.setSystemTime(T0);
    });
    expect(result.current).toBe('1m');
    unmount();
  });

  it('holds an age steady when the clock steps backwards', () => {
    // 59m, one tick before the hour: charging that tick as elapsed time would
    // jump the reading over the boundary it is sitting on.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { result, unmount } = renderHook(() => useRelativeTime(59 * 60));
    expect(result.current).toBe('59m');
    act(() => {
      vi.setSystemTime(+T0 - 3600_000);
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('59m');
    unmount();
  });

  it('stops the shared ticker when the last subscriber unmounts', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useRelativeTime(10));
    const second = renderHook(() => useRelativeTime(20));
    expect(vi.getTimerCount()).toBe(1);
    first.unmount();
    expect(vi.getTimerCount()).toBe(1);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const third = renderHook(() => useRelativeTime(10));
    expect(vi.getTimerCount()).toBe(1);
    third.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
