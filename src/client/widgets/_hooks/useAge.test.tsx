import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAge } from './useAge';

afterEach(() => {
  vi.useRealTimers();
});

describe('useAge', () => {
  it("returns '2h' for 2h ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
    const published = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { result, unmount } = renderHook(() => useAge(published));
    expect(result.current).toBe('2h');
    unmount();
  });

  it('returns empty for null', () => {
    const { result, unmount } = renderHook(() => useAge(null));
    expect(result.current).toBe('');
    unmount();
  });

  it('ages live via shared ticker', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
    const published = new Date(Date.now() - 59 * 1000).toISOString();
    const { result, unmount } = renderHook(() => useAge(published));
    expect(result.current).toBe('59s');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('1m');
    unmount();
  });
});
