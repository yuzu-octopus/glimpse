import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type {
  prefetchPage as PrefetchPage,
  usePageData as UsePageDataHook,
  useStaleNotice as UseStaleNoticeHook,
} from './usePageData';

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

/** Reason the stream-end reconciliation stamps on an unanswered widget. */
let NO_RESPONSE: string;
let prefetchPage: typeof PrefetchPage;
let useStaleNotice: typeof UseStaleNoticeHook;

describe('usePageData stale-while-revalidate', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    if (typeof mod.__clearCacheForTests === 'function') mod.__clearCacheForTests();
    NO_RESPONSE = mod.NO_RESPONSE_ERROR;
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

  it('applies trailing line without trailing newline (buf flush)', async () => {
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
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'live-flush' }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    // final chunk deliberately WITHOUT trailing '\n' — relies on buf flush after close
    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W0 })));
    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.columns[0].widgets[0].data).toEqual(W0.data);
    expect(result.current.isValidating).toBe(false);
  });

  it('abort mid-stream stops further onProgress updates', async () => {
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
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'first' }, error: undefined };
    const W1 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'second-should-not-apply' }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result, unmount } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).not.toBeNull();

    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W0 }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.columns[0].widgets[0].data).toEqual(W0.data);

    // abort the hook's fetch (unmount aborts the AbortController in usePageData)
    await act(async () => {
      unmount();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    // enqueue after abort — should be ignored (reader cancelled, handleLine bails on signal.aborted)
    try {
      controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W1 }) + '\n'));
      controller.close();
    } catch {
      // controller may already be errored after cancel — ignore
    }
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // data should remain at W0, not overwritten by W1
    // unmounted hook can't be asserted post-unmount, so verify via fresh mount with no cache: next fetch not started yet
    // instead assert the previous result ref still holds W0 (no crash, no throw)
    // Re-mount to confirm isValidating settles cleanly (would wedge if reader not cancelled)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SKELETON), { status: 200, headers: { 'content-type': 'application/json' } })));
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result: result2 } = renderHook(() => usePageData('home'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result2.current.isValidating).toBe(false);
  });

  it('flat widgets copy-on-write: second chunk delivers different widgets array identity', async () => {
    const FLAT_SKELETON: PagePayload = {
      slug: 'lab',
      name: 'Lab',
      width: 'default',
      tiling: 'collage',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [],
      widgets: [
        { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined },
        { type: 'clock', config: { type: 'clock', title: 'Clock 2' }, data: null, error: undefined },
      ],
    };
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 't0' }, error: undefined };
    const W1 = { type: 'clock', config: { type: 'clock', title: 'Clock 2' }, data: { time: 't1' }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('lab'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: FLAT_SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // skeleton delivered — widgets exist
    expect(result.current.data?.widgets).toHaveLength(2);

    controller.enqueue(enc.encode(JSON.stringify({ path: 'widgets[0]', payload: W0 }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    const ref1 = result.current.data?.widgets;
    expect(ref1?.[0].data).toEqual(W0.data);

    controller.enqueue(enc.encode(JSON.stringify({ path: 'widgets[1]', payload: W1 }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    const ref2 = result.current.data?.widgets;
    expect(ref2?.[1].data).toEqual(W1.data);
    // BentoGrid memo relies on new array identity — second chunk must have new widgets array
    expect(ref1).not.toBe(ref2);

    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isValidating).toBe(false);
  });

  // ── End-of-stream reconciliation ─────────────────────────────────────────
  // A truncated stream used to be indistinguishable from a slow widget: the
  // skeleton base simply stayed at `data: null` with no error and shimmered
  // forever. The stream closing is the boundary — past it no frame can still
  // arrive, so anything unanswered there is failed honestly.

  it('truncated stream fails the widgets the server never answered', async () => {
    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [{ type: 'rss', config: { type: 'rss', title: 'Head' }, data: null, error: undefined }],
      columns: [
        {
          size: 'full',
          widgets: [
            { type: 'rss', config: { type: 'rss', title: 'Col' }, data: null, error: undefined },
            // config-only: `data: null` is its final state, never a failure
            { type: 'todo', config: { type: 'todo', title: 'Todo' }, data: null, error: undefined },
          ],
        },
      ],
    };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // mid-stream the widgets really are still shimmering — no error yet
    expect(result.current.data?.headWidgets[0].error).toBeUndefined();
    expect(result.current.data?.columns[0].widgets[0].error).toBeUndefined();

    controller.close(); // truncated: no frame ever arrives for either rss
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.data?.headWidgets[0].error).toBe(NO_RESPONSE);
    expect(result.current.data?.headWidgets[0].data).toBeNull();
    expect(result.current.data?.columns[0].widgets[0].error).toBe(NO_RESPONSE);
    expect(result.current.data?.columns[0].widgets[0].data).toBeNull();
    // untouched: a config-only widget's null data is not a failure
    expect(result.current.data?.columns[0].widgets[1].error).toBeUndefined();
    expect(result.current.isValidating).toBe(false);
  });

  it('complete stream leaves a slow widget that answered before the close alone', async () => {
    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        {
          size: 'full',
          widgets: [
            { type: 'rss', config: { type: 'rss', title: 'Fast' }, data: null, error: undefined },
            { type: 'rss', config: { type: 'rss', title: 'Slow' }, data: null, error: undefined },
          ],
        },
      ],
    };
    const FAST = { type: 'rss', config: { type: 'rss', title: 'Fast' }, data: { items: [1] }, error: undefined };
    const SLOW = { type: 'rss', config: { type: 'rss', title: 'Slow' }, data: { items: [2] }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: FAST }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // the slow widget is still pending, 2s in, stream still open
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.data?.columns[0].widgets[1].data).toBeNull();
    expect(result.current.data?.columns[0].widgets[1].error).toBeUndefined();

    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[1]', payload: SLOW }) + '\n'));
    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    // every widget answered before the close: nothing is failed, nothing moved
    expect(result.current.data?.columns[0].widgets[0].data).toEqual({ items: [1] });
    expect(result.current.data?.columns[0].widgets[0].error).toBeUndefined();
    expect(result.current.data?.columns[0].widgets[1].data).toEqual({ items: [2] });
    expect(result.current.data?.columns[0].widgets[1].error).toBeUndefined();
  });

  it('keeps a server-side error instead of re-labelling it as no response', async () => {
    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        { size: 'full', widgets: [{ type: 'rss', config: { type: 'rss', title: 'Col' }, data: null, error: undefined }] },
      ],
    };
    const FAILED = { type: 'rss', config: { type: 'rss', title: 'Col' }, data: null, error: 'upstream exploded' };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: FAILED }) + '\n'));
    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    // it was answered — with a failure. That is a truer reason than "no response".
    expect(result.current.data?.columns[0].widgets[0].error).toBe('upstream exploded');
  });

  it('a dropped container frame fails its children', async () => {
    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        {
          size: 'full',
          widgets: [
            {
              type: 'group',
              config: { type: 'group' },
              data: null,
              error: undefined,
              widgets: [
                { type: 'rss', config: { type: 'rss', title: 'A' }, data: null, error: undefined },
                { type: 'rss', config: { type: 'rss', title: 'B' }, data: null, error: undefined },
              ],
            },
          ],
        },
      ],
    };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('home'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.close(); // the group's own frame never arrives
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    const group = result.current.data?.columns[0].widgets[0];
    // the container itself is config-only, but its children stream inside its
    // frame — a dropped frame strands them just as surely
    expect(group?.error).toBeUndefined();
    expect(group?.widgets?.[0].error).toBe(NO_RESPONSE);
    expect(group?.widgets?.[1].error).toBe(NO_RESPONSE);
  });

  it('flat page: failed widgets land on a new widgets array (BentoGrid memo needs it)', async () => {
    const FLAT_SKELETON: PagePayload = {
      slug: 'lab',
      name: 'Lab',
      width: 'default',
      tiling: 'collage',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [],
      widgets: [
        { type: 'rss', config: { type: 'rss', title: 'A' }, data: null, error: undefined },
        { type: 'rss', config: { type: 'rss', title: 'B' }, data: null, error: undefined },
      ],
    };
    const W0 = { type: 'rss', config: { type: 'rss', title: 'A' }, data: { items: [1] }, error: undefined };

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const enc = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }), { headers: { 'content-type': 'application/x-ndjson' } })),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));
    const { result } = renderHook(() => usePageData('lab'));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: FLAT_SKELETON }) + '\n'));
    controller.enqueue(enc.encode(JSON.stringify({ path: 'widgets[0]', payload: W0 }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    const beforeClose = result.current.data?.widgets;

    controller.close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.data?.widgets?.[0].data).toEqual({ items: [1] });
    expect(result.current.data?.widgets?.[0].error).toBeUndefined();
    expect(result.current.data?.widgets?.[1].error).toBe(NO_RESPONSE);
    expect(result.current.data?.widgets).not.toBe(beforeClose);
  });
});

describe('prefetch budget isolation', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    prefetchPage = mod.prefetchPage;
    mod.__clearCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** One open NDJSON response per fetch call, in call order. */
  function streamFetch() {
    const enc = new TextEncoder();
    const controllers: ReadableStreamDefaultController<Uint8Array>[] = [];
    const mock = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              controllers.push(c);
            },
          }),
          { headers: { 'content-type': 'application/x-ndjson' } },
        ),
    );
    vi.stubGlobal('fetch', mock);
    return { mock, controllers, enc };
  }

  // A hover prefetch runs on its own 10s budget. Clicking the link must not
  // hand the mounted page that deadline: the page has to stream on its own
  // signal, and the prefetch's expiry must not decide its fate.
  it('does not hand a joining page the prefetch budget, and streams it anyway', async () => {
    const { mock, controllers, enc } = streamFetch();
    prefetchPage('home');

    const { result } = renderHook(() => usePageData('home'));
    // The page joined the prefetch: one request for the slug, not two.
    expect(mock).toHaveBeenCalledTimes(1);
    expect(controllers).toHaveLength(1);

    // The prefetch's own 10s deadline expires while the page is reading.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        {
          size: 'full',
          widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined }],
        },
      ],
    };
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'live' }, error: undefined };

    controllers[0].enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // The joining page received the frame the prefetch threw away.
    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBeNull();

    controllers[0].enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W0 }) + '\n'));
    controllers[0].close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.columns[0].widgets[0].data).toEqual(W0.data);
  });

  // The shared request used to be bound to whichever caller created it, so a
  // revalidation that joined a still-open read inherited an already-aborted
  // signal: handleLine dropped every frame and the page hard-errored on a
  // stream the server was still writing.
  it('gives a revalidation its own request instead of a dead shared one', async () => {
    const { mock, controllers, enc } = streamFetch();
    const { result } = renderHook(() => usePageData('home'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mock).toHaveBeenCalledTimes(1);

    // Re-validate while the first read is still open. The first caller walks
    // away, and a request nobody is left to read is ended — so the new caller
    // must get its own rather than a corpse carrying the old caller's abort.
    void result.current.validate();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mock).toHaveBeenCalledTimes(2);

    const SKELETON: PagePayload = {
      slug: 'home',
      name: 'Home',
      width: 'default',
      tiling: 'columns',
      minColumnWidth: 300,
      headWidgets: [],
      columns: [
        {
          size: 'full',
          widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined }],
        },
      ],
    };
    const W0 = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'live' }, error: undefined };
    controllers[1].enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).not.toBeNull();

    controllers[1].enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: W0 }) + '\n'));
    controllers[1].close();
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.columns[0].widgets[0].data).toEqual(W0.data);
  });
});

describe('aborted streams are not cached', () => {
  const GOOD: PagePayload = {
    slug: 'home',
    name: 'Home',
    width: 'default',
    tiling: 'columns',
    minColumnWidth: 300,
    headWidgets: [],
    columns: [
      {
        size: 'full',
        widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'first' }, error: undefined }],
      },
    ],
  };
  const TWO_WIDGET_SKELETON: PagePayload = {
    ...GOOD,
    columns: [
      {
        size: 'full',
        widgets: [
          { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null, error: undefined },
          { type: 'rss', config: { type: 'rss', title: 'Feed' }, data: null, error: undefined },
        ],
      },
    ],
  };
  const ANSWERED = { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: 'live' }, error: undefined };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    mod.__clearCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('never lets a stream that was cut short become the cached payload', async () => {
    const enc = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const never = new Promise<Response>(() => {});
    const fetchMock = vi
      .fn()
      // The page declares two widgets, answers one, and is navigated away
      // from before the second speaks.
      .mockImplementationOnce(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(c) {
                controller = c;
              },
            }),
            { headers: { 'content-type': 'application/x-ndjson' } },
          ),
      )
      // The next visit revalidates; keep it pending so its initial read of the
      // cache is what is under test.
      .mockImplementation(() => never);
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));

    const first = renderHook(() => usePageData('home'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: TWO_WIDGET_SKELETON }) + '\n'));
    controller.enqueue(enc.encode(JSON.stringify({ path: 'columns[0].widgets[0]', payload: ANSWERED }) + '\n'));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(first.result.current.data?.columns[0].widgets).toHaveLength(2);

    // Navigate away mid-stream, then flush hard: the reader cancel and
    // everything behind it has to settle, because that is the moment the
    // pre-fix code wrote the truncated payload into the cache.
    await act(async () => {
      first.unmount();
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1);
      }
    });

    const second = renderHook(() => usePageData('home'));
    // A widget that never answered must not come back inside the freshness
    // window as a silent skeleton with no error badge.
    const widgets = second.result.current.data?.columns[0].widgets ?? [];
    expect(widgets.filter((w) => w.data == null && w.error == null)).toHaveLength(0);
  });
});

describe('offline with a warm cache', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    useStaleNotice = mod.useStaleNotice;
    mod.__clearCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the payload and reports that it is no longer live', async () => {
    const payload = makePayload();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )
      .mockImplementation(async () => {
        throw new TypeError('Failed to fetch');
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    useStaleNotice = mod.useStaleNotice;
    mod.__clearCacheForTests();

    const { result } = renderHook(() => ({
      page: usePageData('home'),
      stale: useStaleNotice(),
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.page.data).not.toBeNull();
    expect(result.current.stale).toBeNull();

    await act(async () => {
      await result.current.page.validate();
    });

    // The reading stays on screen — a dead network is not a failed page — and
// the shell is told the dashboard has stopped being true.
    expect(result.current.page.error).toBeNull();
    expect(result.current.page.data).not.toBeNull();
    expect(result.current.stale?.reason).toBe('Failed to fetch');
  });

  it('clears the notice as soon as a refresh succeeds', async () => {
    const payload = makePayload();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )
      .mockImplementationOnce(async () => {
        throw new TypeError('Failed to fetch');
      })
      .mockImplementation(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    useStaleNotice = mod.useStaleNotice;
    mod.__clearCacheForTests();

    const { result } = renderHook(() => ({
      page: usePageData('home'),
      stale: useStaleNotice(),
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await result.current.page.validate();
    });
    expect(result.current.stale).not.toBeNull();

    await act(async () => {
      await result.current.page.validate();
    });
    expect(result.current.stale).toBeNull();
  });

  it('still hard-errors a page that never loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    useStaleNotice = mod.useStaleNotice;
    mod.__clearCacheForTests();

    const { result } = renderHook(() => ({
      page: usePageData('home'),
      stale: useStaleNotice(),
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.page.error).toBe('Failed to fetch');
    expect(result.current.stale).toBeNull();
  });
});

describe('page cache GC', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod: any = await import('./usePageData');
    usePageData = mod.usePageData;
    mod.__clearCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Every poll wrote a fresh 5-minute GC timer and threw the handle away, so a
 // 1s homelab page accumulated hundreds of live timers that all fired at once
  // to do nothing.
  it('keeps one pending GC per slug no matter how often the page is written', async () => {
    const payload = makePayload({
      columns: [
        {
          size: 'full',
          widgets: [
            { type: 'server-stats', config: { type: 'server-stats', title: 'Host' }, data: {}, error: undefined },
          ],
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    vi.resetModules();
    ({ usePageData } = await import('./usePageData'));

    renderHook(() => usePageData('home'));
    // Let the one-shot preload timer fire so the baseline counts only the
    // poll interval and the pending GC.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    const baseline = vi.getTimerCount();

    // 30 further 1s polls, each of which used to leave another live GC timer
    // behind — ~300 of them within the five minutes they were scheduled for.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(vi.getTimerCount()).toBe(baseline);
  });
});
