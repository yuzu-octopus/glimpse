import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './immich';
import type { MediaData } from '../../shared/widgets/payloads';

const SEARCH_FIXTURE = {
  assets: {
    items: [
      { id: 'a1', originalFileName: 'IMG_001.jpg', localDateTime: '2024-05-01T10:00:00' },
      { id: 'a2', originalFileName: 'photos/IMG_002.jpg', fileCreatedAt: '2024-05-02T10:00:00Z' },
    ],
  },
};

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, env: Record<string, string | undefined> = {}): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('immich')!;

describe('immich fetcher', () => {
  it('maps search results to media items with poster + photo links', async () => {
    const ctx = makeCtx(async () => new Response(JSON.stringify(SEARCH_FIXTURE), { status: 200 }));
    const data = (await fetcher()(ctx, { type: 'immich', url: 'https://immich.lab', 'api-key': 'k' })) as MediaData;
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toEqual({
      title: 'IMG_001.jpg',
      subtitle: null,
      poster: 'https://immich.lab/api/assets/a1/thumbnail',
      url: 'https://immich.lab/photos/a1',
      date: '2024-05-01T10:00:00',
    });
    expect(data.items[1].title).toBe('IMG_002.jpg');
  });

  it('reads the api key from IMMICH_API_KEY and throws without one', async () => {
    const ok = makeCtx(async () => new Response(JSON.stringify(SEARCH_FIXTURE), { status: 200 }), { IMMICH_API_KEY: 'env-key' });
    const data = (await fetcher()(ok, { type: 'immich', url: 'https://immich.lab' })) as MediaData;
    expect(data.items).toHaveLength(2);
    const missing = makeCtx(async () => new Response('{}', { status: 200 }));
    await expect(fetcher()(missing, { type: 'immich', url: 'https://immich.lab' })).rejects.toThrow(/api-key/i);
  });

  it('applies the limit', async () => {
    const ctx = makeCtx(async () => new Response(JSON.stringify(SEARCH_FIXTURE), { status: 200 }));
    const data = (await fetcher()(ctx, { type: 'immich', url: 'https://immich.lab/', 'api-key': 'k', limit: 1 })) as MediaData;
    expect(data.items).toHaveLength(1);
  });
});
