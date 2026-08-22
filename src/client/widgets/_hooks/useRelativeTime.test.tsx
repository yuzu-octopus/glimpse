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
  it('ages by one minute per shared tick', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useRelativeTime(100));
    expect(result.current).toBe('1m');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('2m');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('3m');
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
