import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type { usePageData as UsePageDataHook } from './usePageData';

function makePayload(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    slug: 'home',
    name: 'Home',
    width: 'default',
    tiling: 'columns',
    minColumnWidth: 300,
    headWidgets: [],
    columns: [
      {
        size: 'full',
        widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: {}, error: undefined }],
      },
    ],
    ...overrides,
  };
}

// Dynamic import after vi.resetModules() is required to get a fresh module
// instance with the stubbed fetch and fake timers — static import would
// capture the module before the stub is installed (test boundary).
let usePageData: typeof UsePageDataHook;

describe('usePageData stale-while-revalidate', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polling keeps stale data while validating', async () => {
    const payload1 = makePayload();
    const payload2 = makePayload({ name: 'Home updated' });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(payload1), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) =>
            setTimeout(
              () => resolve(new Response(JSON.stringify(payload2), { status: 200, headers: { 'content-type': 'application/json' } })),
              100,
            ),
          ),
      )
      .mockImplementation(async () =>
        new Response(JSON.stringify(payload2), { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));

    const { result } = renderHook(() => usePageData('home'));

    // Flush initial fetch (microtasks)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
      // flush pending promises
      await Promise.resolve();
    });
    // Allow React state to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.data).toBeTruthy();
    const stale = result.current.data;
    expect(stale?.name).toBe('Home');
    expect(result.current.isValidating).toBe(false);

    // Advance 30s to trigger LIVE poll interval (clock is LIVE)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Interval callback sets isValidating true and starts delayed fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5);
    });

    expect(result.current.data).toBe(stale);
    expect(result.current.isValidating).toBe(true);
    expect(result.current.data).not.toBeNull();

    // Now let the delayed fetch resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.name).toBe('Home updated');
    expect(result.current.isValidating).toBe(false);
  });

  it('shows skeleton only on initial load, not on revalidation', async () => {
    const payload1 = makePayload();
    const payload2 = makePayload({ name: 'Home v2' });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify(payload1), { status: 200 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) =>
            setTimeout(() => resolve(new Response(JSON.stringify(payload2), { status: 200 })), 100),
          ),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    expect(result.current.data).toBeNull();
    expect(result.current.isValidating).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.data?.name).toBe('Home');
    expect(result.current.isValidating).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(5);
    });
    expect(result.current.data?.name).toBe('Home');
    expect(result.current.isValidating).toBe(true);
  });
});
