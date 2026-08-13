import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useConfig as UseConfigHook } from './useConfig';

// The module keeps `cached` across mounts; reset the module registry so each
// test starts with a clean cache. Static import cannot be used: the binding
// would survive `vi.resetModules()` and defeat the isolation.
let useConfig: typeof UseConfigHook;

beforeEach(async () => {
  vi.resetModules();
  ({ useConfig } = await import('./useConfig'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const okResponse = {
  ok: true,
  json: async () => ({ config: { title: 'home' } }),
};

describe('useConfig', () => {
  it('retries a rejected fetch on the next mount instead of caching it', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(okResponse);
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useConfig());
    await waitFor(() =>
      expect(first.result.current).toEqual({
        status: 'error',
        error: 'network down',
      }),
    );
    first.unmount();

    const second = renderHook(() => useConfig());
    await waitFor(() =>
      expect(second.result.current.status).toBe('ready'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares a resolved config across mounts without refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse);
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useConfig());
    await waitFor(() =>
      expect(first.result.current.status).toBe('ready'),
    );
    first.unmount();

    const second = renderHook(() => useConfig());
    await waitFor(() =>
      expect(second.result.current.status).toBe('ready'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
