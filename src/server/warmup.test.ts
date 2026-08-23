import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WidgetFetchContext } from './widgets/registry';
import type { Config } from '../shared/config';
import { TtlCache, Singleflight } from './cache';

const mocks = vi.hoisted(() => ({
  buildPagePayload: vi.fn(async () => ({ ok: true })),
  getConfig: vi.fn(),
}));

vi.mock('./api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./api')>();
  return { ...mod, buildPagePayload: mocks.buildPagePayload };
});

vi.mock('./config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./config')>();
  return { ...mod, getConfig: mocks.getConfig };
});

import { warmCache } from './warmup';

function makeCtx(): WidgetFetchContext {
  return {
    fetch: globalThis.fetch.bind(globalThis) as typeof fetch,
    env: {} as Record<string, string>,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const okConfig = {
  ok: true as const,
  errors: [] as string[],
  files: [] as string[],
  config: {
    pages: [
      { name: 'A', slug: 'a', columns: [{ size: 'full' as const, widgets: [{ type: 'clock' }] }] },
      { name: 'B', slug: 'b', columns: [{ size: 'full' as const, widgets: [{ type: 'clock' }] }] },
    ],
    theme: undefined,
  } as unknown as Config & { pages: Array<{ name: string; slug: string; columns: unknown[] }> },
};

describe('warmCache', () => {
  beforeEach(() => {
    mocks.buildPagePayload.mockReset();
    mocks.buildPagePayload.mockResolvedValue({} as never);
    mocks.getConfig.mockReset();
  });

  it('builds every page once', async () => {
    mocks.getConfig.mockReturnValue(okConfig);
    const ctx = makeCtx();
    await warmCache(ctx);
    expect(mocks.buildPagePayload).toHaveBeenCalledTimes(2);
    expect(mocks.buildPagePayload).toHaveBeenCalledWith(expect.objectContaining({ slug: 'a' }), ctx);
    expect(mocks.buildPagePayload).toHaveBeenCalledWith(expect.objectContaining({ slug: 'b' }), ctx);
  });

  it('never rejects when a page build fails', async () => {
    mocks.getConfig.mockReturnValue(okConfig);
    mocks.buildPagePayload.mockRejectedValueOnce(new Error('boom'));
    mocks.buildPagePayload.mockResolvedValueOnce({} as never);
    const ctx = makeCtx();
    await expect(warmCache(ctx)).resolves.toBeUndefined();
    expect(mocks.buildPagePayload).toHaveBeenCalledTimes(2);
  });

  it('is idempotent and re-invocable', async () => {
    mocks.getConfig.mockReturnValue(okConfig);
    const ctx = makeCtx();
    await warmCache(ctx);
    await warmCache(ctx);
    expect(mocks.buildPagePayload).toHaveBeenCalledTimes(4);
  });

  it('does nothing when config is not ok', async () => {
    mocks.getConfig.mockReturnValue({ ok: false as const, errors: ['bad'], files: [] });
    const ctx = makeCtx();
    await warmCache(ctx);
    expect(mocks.buildPagePayload).not.toHaveBeenCalled();
  });

  it('does nothing when config has no pages', async () => {
    mocks.getConfig.mockReturnValue({
      ok: true as const,
      errors: [],
      files: [],
      config: { pages: [] } as never,
    });
    const ctx = makeCtx();
    await warmCache(ctx);
    expect(mocks.buildPagePayload).not.toHaveBeenCalled();
  });
});
