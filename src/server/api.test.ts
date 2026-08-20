import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Column, WidgetConfig } from '../shared/config';
import { buildPagePayload, streamPagePayload } from './api';
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

const clockWidget: WidgetConfig = { type: 'clock', timezones: [] };
const rssWidget: WidgetConfig = {
  type: 'rss',
  cache: '1h',
  limit: 5,
  feeds: [{ url: 'https://example.com/feed.xml' }],
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
      page([{ size: 'full', widgets: [{ type: 'monitor', sites: [] }] }], [rssWidget]),
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
});
