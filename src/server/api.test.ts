import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Column, WidgetConfig, WidgetType } from '../shared/config';
import {
  buildPagePayload,
  skeletonPagePayload,
  streamPagePayload,
  type StreamChunk,
} from './api';
import { registerWidget, serverWidgets, type WidgetFetchContext } from './widgets/registry';
import { Singleflight, TtlCache } from './cache';

function makeCtx(overrides: Partial<WidgetFetchContext> = {}): WidgetFetchContext {
  return {
    fetch: vi.fn() as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
    ...overrides,
  };
}

function page(columns: Column[], headWidgets: WidgetConfig[] = []) {
  return { name: 'Home', slug: 'home', columns, 'head-widgets': headWidgets };
}

const clockWidget: WidgetConfig = { type: 'clock', timezones: [], retries: 3, 'show-errors': true };
const rssWidget: WidgetConfig = {
  type: 'rss',
  cache: '1h',
  limit: 5,
  feeds: [{ url: 'https://example.com/feed.xml' }],
  retries: 3,
  'show-errors': true,
};

afterEach(() => {
  serverWidgets.delete('rss' as never);
  serverWidgets.delete('monitor' as never);
  serverWidgets.delete('videos' as never);
});
describe('buildPagePayload', () => {
  it('returns null data for config-only widgets without a fetcher', async () => {
    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [clockWidget] }]),
      makeCtx(),
    );
    expect(payload.columns[0].widgets[0]).toEqual({ type: 'clock', config: clockWidget, data: null });
  });

  // The mobile column toggle reads `columns[].title`; the live payload and the

  // skeleton (which the client patches the stream onto) must both carry it or
  // the label flashes "Column N" and then renames itself.
  it('carries a column title into both the live and the skeleton payload', async () => {
    const named = page([{ size: 'full', title: 'Homelab', widgets: [clockWidget] }]);
    expect((await buildPagePayload(named, makeCtx())).columns[0].title).toBe('Homelab');
    expect(skeletonPagePayload(named).columns[0].title).toBe('Homelab');
    // absent stays absent, so the client falls through to its own fallbacks
    const unnamed = await buildPagePayload(page([{ size: 'full', widgets: [clockWidget] }]), makeCtx());
    expect('title' in unnamed.columns[0]).toBe(false);
  });

  it('fetches data for registered widgets through the fetcher', async () => {
    const fetcher = vi.fn(async () => ({ items: [{ title: 'hello' }] }));
    registerWidget('rss', fetcher);

    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [rssWidget] }]),
      makeCtx(),
    );
    const w = payload.columns[0].widgets[0];
    expect(w.data).toEqual({ items: [{ title: 'hello' }] });
    expect(w.error).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('isolates a failing widget without breaking its siblings', async () => {
    registerWidget('rss', vi.fn(async () => ({ items: [] })));
    registerWidget('monitor', vi.fn(async () => { throw new Error('boom'); }));
    const monitorWidget: WidgetConfig = {
      type: 'monitor',
      sites: [{ url: 'https://example.com' }],
      retries: 3,
      'show-errors': true,
    };

    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [rssWidget, monitorWidget] }]),
      makeCtx(),
    );
    const [rss, monitor] = payload.columns[0].widgets;
    expect(rss.data).toEqual({ items: [] });
    expect(monitor.error).toBe('boom');
    expect(monitor.data).toBeNull();
  });

  it('caches per-widget data so the fetcher runs once within the TTL', async () => {
    const fetcher = vi.fn(async () => ({ items: [{ title: 'x' }] }));
    registerWidget('rss', fetcher);
    const ctx = makeCtx();

    await buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    await buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('refetches after the cache is cleared on config reload', async () => {
    const fetcher = vi.fn(async () => ({ items: [{ title: 'x' }] }));
    registerWidget('rss', fetcher);
    const ctx = makeCtx();

    await buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    expect(fetcher).toHaveBeenCalledOnce();

    ctx.cache.clear(); // what initConfig's onChange does on every reload

    await buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent identical fetches via singleflight', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    const fetcher = vi.fn(() => promise);
    registerWidget('rss', fetcher);
    const ctx = makeCtx();

    const p1 = buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    const p2 = buildPagePayload(page([{ size: 'full', widgets: [rssWidget] }]), ctx);
    resolve({ items: [] });
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('recurses into group children and fetches their data', async () => {
    registerWidget('rss', vi.fn(async () => ({ items: [{ title: 'nested' }] })));
    const groupWidget: WidgetConfig = {
      type: 'group',
      retries: 3,
      'show-errors': true,
      widgets: [{ type: 'rss', cache: '1h' }],
    };
    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [groupWidget] }]),
      makeCtx(),
    );
    const group = payload.columns[0].widgets[0];
    expect(group.data).toBeNull();
    expect(group.widgets?.[0].data).toEqual({ items: [{ title: 'nested' }] });
  });

  it('fetches head-widgets into the headWidgets slot', async () => {
    registerWidget('rss', vi.fn(async () => ({ items: [{ title: 'head' }] })));
    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [clockWidget] }], [rssWidget]),
      makeCtx(),
    );
    expect(payload.headWidgets[0].data).toEqual({ items: [{ title: 'head' }] });
  });

  it('fetches head-widgets concurrently with column widgets', async () => {    const { promise: hPromise, resolve: hResolve } = Promise.withResolvers<unknown>();
    const { promise: cPromise, resolve: cResolve } = Promise.withResolvers<unknown>();
    const headFetcher = vi.fn(() => hPromise);
    const colFetcher = vi.fn(() => cPromise);
    registerWidget('rss', headFetcher);
    registerWidget('monitor', colFetcher);

    const p = buildPagePayload(
      page([{ size: 'full', widgets: [{ type: 'monitor', sites: [], retries: 3, 'show-errors': true }] }], [rssWidget]),
      makeCtx(),
    );
    // Both fetchers started before either resolves: awaiting head first would
    // leave the column fetcher uncalled at this point.
    expect(headFetcher).toHaveBeenCalledOnce();
    expect(colFetcher).toHaveBeenCalledOnce();
    hResolve({ items: [] });
    cResolve({ sites: [] });
    await p;
  });

  it('defaults tiling to columns and minColumnWidth to 300', async () => {
    const payload = await buildPagePayload(
      page([{ size: 'full', widgets: [clockWidget] }]),
      makeCtx(),
    );
    expect(payload.tiling).toBe('columns');
    expect(payload.minColumnWidth).toBe(300);
  });

  it('resolves auto tiling config and carries column spans into the payload', async () => {
    const payload = await buildPagePayload(
      {
        name: 'Home',
        slug: 'home',
        tiling: 'auto',
        'min-column-width': 340,
        columns: [
          { size: 'small', span: 2, widgets: [clockWidget] },
          { size: 'small', widgets: [clockWidget] },
        ],
      },
      makeCtx(),
    );
    expect(payload.tiling).toBe('auto');
    expect(payload.minColumnWidth).toBe(340);
    expect(payload.columns[0].span).toBe(2);
    expect(payload.columns[1].span).toBeUndefined();
  });

  it('resolves collage tiling config and carries column spans into the payload', async () => {
    const payload = await buildPagePayload(
      {
        name: 'Home',
        slug: 'home',
        tiling: 'collage',
        'min-column-width': 360,
        columns: [
          { size: 'small', span: 2, widgets: [clockWidget] },
          { size: 'small', widgets: [clockWidget] },
        ],
      },
      makeCtx(),
    );
    expect(payload.tiling).toBe('collage');
    expect(payload.minColumnWidth).toBe(360);
    expect(payload.columns[0].span).toBe(2);
    expect(payload.columns[1].span).toBeUndefined();
  });
  it('builds flat widgets payload', async () => {
    const fetcher = vi.fn(async () => ({ time: '12:00' }));
    registerWidget('clock', fetcher);
    const flatPage = {
      name: 'X',
      slug: 'x',
      widgets: [{ type: 'clock', timezones: [] }],
      tiling: 'collage',
    } as unknown as Parameters<typeof buildPagePayload>[0];
    const payload = await buildPagePayload(flatPage, makeCtx());
    expect(payload.widgets).toHaveLength(1);
    expect(payload.widgets![0].data).toEqual({ time: '12:00' });
    expect(payload.columns).toEqual([]);
    expect(payload.gridColumns).toBe(12);
    expect(payload.gridRowHeight).toBe(96);
  });

  it('streams flat widgets with w:i cache paths', async () => {
    registerWidget('clock', vi.fn(async () => ({ time: 'now' })));
    const ctx = makeCtx();
    const flatPage = {
      name: 'X',
      slug: 'x',
      widgets: [{ type: 'clock', timezones: [] }],
    } as unknown as Parameters<typeof streamPagePayload>[0];
    const chunks: StreamChunk[] = [];
    for await (const c of streamPagePayload(flatPage, ctx)) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].path).toBe('widgets[0]');
    expect(chunks[0].payload.data).toEqual({ time: 'now' });
  });
});


describe('streamPagePayload', () => {
  it('stream page flushes head widgets before slow videos', async () => {
    const headFetcher = vi.fn(async () => ({ items: [{ title: 'head' }] }));
    const slowFetcher = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          setTimeout(() => resolve({ videos: [{ title: 'slow' }] }), 40);
        }),
    );
    registerWidget('rss', headFetcher);
    registerWidget('videos', slowFetcher);
    const ctx = makeCtx();
    const testPage = {
      name: 'Home',
      slug: 'home',
      columns: [{ size: 'full', widgets: [{ type: 'videos' }] }],
      'head-widgets': [{ type: 'rss', cache: '1h' }],
    } as unknown as Parameters<typeof streamPagePayload>[0];
    const chunks: Array<{ path: string; payload: unknown }> = [];
    for await (const c of streamPagePayload(testPage, ctx)) chunks.push(c as unknown as { path: string; payload: unknown });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].path).toMatch(/headWidgets/);
    expect(chunks[1].path).toMatch(/columns/);
  });

  it('delivers a frame for every configured widget, even when fetches fail', async () => {
    // A dropped chunk leaves the client on the skeleton frame it already
    // rendered, with nothing to tell it apart from a slow widget — the
    // skeleton never resolves and no error is shown. Every configured
    // widget must get a frame, carrying the error when it failed.
    registerWidget('rss', vi.fn(async () => {
      throw new Error('upstream exploded');
    }));
    const testPage = {
      name: 'Home',
      slug: 'home',
      columns: [{ size: 'full', widgets: [{ type: 'rss' }, clockWidget] }],
    } as unknown as Parameters<typeof streamPagePayload>[0];
    const chunks: StreamChunk[] = [];
    for await (const c of streamPagePayload(testPage, makeCtx())) chunks.push(c);
    expect(chunks).toHaveLength(2);
    const failed = chunks.find((c) => c.payload.type === 'rss');
    expect(failed?.payload.error).toBe('upstream exploded');
  });

  it('carries each failing widget its own error, head / column / nested child alike', async () => {
    // The invariant behind the client's end-of-stream reconciliation: a widget
    // that never gets a frame is indistinguishable from a slow one, so *every*
    // configured widget must get one — and the frame must carry that widget's
    // own failure, not a neighbour's. `fetchWidget` catches every fetcher
    // rejection into `payload.error` and the container recursion is
    // `Promise.all` over `fetchWidget`, so no chunk can legitimately be
    // dropped. This pins both halves: the frame count and the per-widget
    // error, at every nesting depth the stream delivers.
    const errors: Array<[WidgetType, string]> = [
      ['rss', 'feed upstream returned 503'],
      ['videos', 'channel lookup timed out'],
      ['monitor', 'no API key configured'],
    ];
    for (const [type, message] of errors) {
      registerWidget(type, vi.fn(async () => {
        throw new Error(message);
      }));
    }
    const testPage = {
      name: 'Home',
      slug: 'home',
      'head-widgets': [{ type: 'rss', cache: '1h' }],
      columns: [
        { size: 'full', widgets: [{ type: 'videos' }, clockWidget] },
        {
          size: 'full',
          widgets: [
            { type: 'group', retries: 3, 'show-errors': true, widgets: [{ type: 'monitor' }, { type: 'rss', cache: '1h' }] },
          ],
        },
      ],
    } as unknown as Parameters<typeof streamPagePayload>[0];

    const chunks: StreamChunk[] = [];
    for await (const c of streamPagePayload(testPage, makeCtx())) chunks.push(c);

    // one frame per configured top-level widget: head, 2 in col 0, 1 in col 1
    expect(chunks).toHaveLength(4);
    expect(chunks.map((c) => c.path).sort()).toEqual([
      'columns[0].widgets[0]',
      'columns[0].widgets[1]',
      'columns[1].widgets[0]',
      'headWidgets[0]',
    ]);

    const find = (path: string): StreamChunk => {
      const hit = chunks.find((c) => c.path === path);
      expect(hit, `no frame for ${path}`).toBeDefined();
      return hit!;
    };

    // each frame carries its own widget's message
    expect(find('headWidgets[0]').payload.error).toBe('feed upstream returned 503');
    expect(find('columns[0].widgets[0]').payload.error).toBe('channel lookup timed out');
    // the config-only widget still gets a frame, and it is not an error
    expect(find('columns[0].widgets[1]').payload.type).toBe('clock');
    expect(find('columns[0].widgets[1]').payload.error).toBeUndefined();

    // nested children ride inside the container frame, each with its own error
    const group = find('columns[1].widgets[0]').payload;
    expect(group.widgets).toHaveLength(2);
    expect(group.widgets?.[0].error).toBe('no API key configured');
    expect(group.widgets?.[1].error).toBe('feed upstream returned 503');

    // a failure is always `data: null` + a reason, never a silent null
    for (const c of chunks) {
      for (const w of c.payload.widgets ?? [c.payload]) {
        if (w.error !== undefined) expect(w.data).toBeNull();
      }
    }
  });
});

describe('skeletonPagePayload', () => {
  it('forces hide-header on flat widgets too when hide-headers is set', () => {
    const flatPage = {
      name: 'Grid',
      slug: 'grid',
      'hide-headers': true,
      widgets: [{ type: 'clock', timezones: [] }],
    } as unknown as Parameters<typeof skeletonPagePayload>[0];
    const payload = skeletonPagePayload(flatPage);
    expect(payload.widgets?.[0].config).toMatchObject({ 'hide-header': true });
  });
});
