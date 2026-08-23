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
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    if (typeof mod.__clearCacheForTests === 'function') mod.__clearCacheForTests();
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
    // Clear global cache between tests — new module instance already has fresh cache via resetModules
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));

    const { result } = renderHook(() => usePageData('home'));

    // Flush initial fetch (microtasks) — with SWR cache, first load may be from cache, so wait for isValidating false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    // Poll until data appears (fetch is async)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
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
      void result.current.validate();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.name).toBe('Home');
    expect(result.current.isValidating).toBe(true);
  });

  it('abort-during-poll then next poll succeeds (no wedged isValidating)', async () => {
    const payload1 = makePayload();
    const payload2 = makePayload({ name: 'Home updated' });
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(payload1), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockImplementationOnce(async () => {
        throw abortErr;
      })
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(payload2), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockImplementation(async () =>
        new Response(JSON.stringify(payload2), { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.name).toBe('Home');
    expect(result.current.isValidating).toBe(false);

    // first poll -> AbortError
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    // AbortError should reset isValidating, not wedge
    expect(result.current.isValidating).toBe(false);
    expect(result.current.data?.name).toBe('Home');

    // next poll succeeds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.name).toBe('Home updated');
    expect(result.current.isValidating).toBe(false);
  });

  it('shape-drift: new column in skeleton while cached renders new column with preserved data', async () => {
    const payload1 = makePayload();
    // skeleton with 2 columns: second is new
    const skeletonPayload: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined }] },
        { size: 'full', widgets: [{ type: 'weather', config: { type: 'weather', title: 'Weather' }, data: null, error: undefined }] },
      ],
    };
    const chunkPayload = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'new' }, error: undefined };
    const ndjsonBody = [
      JSON.stringify({ path: '$skeleton', payload: skeletonPayload }),
      JSON.stringify({ path: 'columns[0].widgets[0]', payload: chunkPayload }),
    ].join('\n');

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify(payload1), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockImplementationOnce(
        async () => new Response(ndjsonBody, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
      );

    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.columns).toHaveLength(1);
    expect(result.current.isValidating).toBe(false);

    await act(async () => {
      void result.current.validate();
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.data?.columns).toHaveLength(2);
    // first widget updated via chunk
    expect(result.current.data?.columns[0].widgets[0].data).toEqual({ time: 'new' });
    // second column is new skeleton widget (null data)
    expect(result.current.data?.columns[1].widgets[0].type).toBe('weather');
    expect(result.current.isValidating).toBe(false);
  });

  it('force reload shows skeleton base (bypass cached overlay)', async () => {
    const payload1 = makePayload({
      columns: [
        {
          size: 'full',
          widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'old' }, error: undefined }],
        },
      ],
    });
    const skeletonPayload: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined }] },
        { size: 'full', widgets: [{ type: 'weather', config: { type: 'weather', title: 'Weather' }, data: null, error: undefined }] },
      ],
    };
    // force reload: skeleton only, no chunk for clock -> clock stays null
    const ndjsonBody = JSON.stringify({ path: '$skeleton', payload: skeletonPayload });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify(payload1), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockImplementationOnce(async () => new Response(ndjsonBody, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }));

    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.data?.columns).toHaveLength(1);
    expect(result.current.data?.columns[0].widgets[0].data).toEqual({ time: 'old' });

    await act(async () => {
      void result.current.reload(true);
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // force reload bypassed cached overlay: skeleton base, no cached data
    expect(result.current.data?.columns).toHaveLength(2);
    expect(result.current.data?.columns[0].widgets[0].data).toBeNull();
    expect(result.current.data?.columns[1].widgets[0].type).toBe('weather');
    expect(result.current.isValidating).toBe(false);
  });

  it('renders early chunks before the stream closes', async () => {
    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined }] },
      ],
    };
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'live' }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    // flush microtasks so hook starts fetching and fetch() captures controller
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).not.toBeNull(); // skeleton painted WITHOUT closing stream

    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W0 }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.columns[0].widgets[0].data).toEqual(W0.data); // chunk applied live

    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isValidating).toBe(false);
  });
});
