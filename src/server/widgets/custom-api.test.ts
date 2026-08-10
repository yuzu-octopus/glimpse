import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './custom-api';
import type { CustomApiItem } from './custom-api';

const API_PAYLOAD = {
  results: [
    {
      title: 'First',
      link: 'https://example.com/1',
      meta: { stars: 12 },
      tags: ['a', 'b'],
      published_at: '2024-01-01',
    },
    { title: 'Second', link: 'https://example.com/2' },
  ],
};

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const customApiFetcher = () => serverWidgets.get('custom-api')!;

describe('custom-api fetcher', () => {
  it('maps JSONPath fields from a root array and appends parameters', async () => {
    const ctx = makeCtx(async (url, init) => {
      expect(url).toBe('https://api.example.com/items?page=2&key=abc');
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify(API_PAYLOAD), { status: 200 });
    });
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/items',
      parameters: { page: '2', key: 'abc' },
      options: {
        path: '$.results[*]',
        title: '$.title',
        url: '$.link',
        subtitle: '$.meta.stars',
        timestamp: '$.published_at',
      },
    })) as { items: CustomApiItem[]; frameless: boolean };
    expect(data.frameless).toBe(false);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toEqual({
      title: 'First',
      url: 'https://example.com/1',
      description: null,
      icon: null,
      subtitle: '12',
      value: null,
      image: null,
      timestamp: '2024-01-01',
    });
  });

  it('wraps a non-array root and defaults title to empty string', async () => {
    const ctx = makeCtx(async () =>
      new Response(JSON.stringify({ name: 'Solo' }), { status: 200 }),
    );
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/solo',
      options: { path: '$', title: '$.name' },
    })) as { items: CustomApiItem[] };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Solo');
  });

  it('nulls empty results and missing expressions', async () => {
    const ctx = makeCtx(async () =>
      new Response(JSON.stringify(API_PAYLOAD), { status: 200 }),
    );
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/items',
      options: { path: '$.results[*]', title: '$.missing', url: '$.link' },
    })) as { items: CustomApiItem[] };
    expect(data.items[0].title).toBe('');
    expect(data.items[0].url).toBe('https://example.com/1');
  });

  it('sends POST body with json content-type header', async () => {
    const ctx = makeCtx(async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe('{"query":"x"}');
      expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/search',
      method: 'POST',
      'body-type': 'json',
      body: '{"query":"x"}',
      options: { path: '$' },
    })) as { items: CustomApiItem[]; frameless: boolean };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe(''); // boolean root has no fields
  });

  it('throws on non-2xx responses', async () => {
    const ctx = makeCtx(async () => new Response('nope', { status: 500 }));
    await expect(
      customApiFetcher()(ctx, { type: 'custom-api', url: 'https://api.example.com/boom' }),
    ).rejects.toThrow('HTTP 500');
  });

  it('sets json content-type for map bodies even without body-type', async () => {
    const ctx = makeCtx(async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe('{"query":"x"}');
      expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
      return new Response(JSON.stringify([{ title: 'A' }]), { status: 200 });
    });
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/search',
      method: 'POST',
      body: { query: 'x' },
      options: { path: '$[*]', title: '$.title' },
    })) as { items: CustomApiItem[] };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('A');
  });

  it('repeats array parameters as repeated query params', async () => {
    const ctx = makeCtx(async (url) => {
      expect(url).toContain('tag=a&tag=b');
      return new Response(JSON.stringify([{ title: 'A' }]), { status: 200 });
    });
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/items',
      parameters: { tag: ['a', 'b'] },
      options: { path: '$', title: '$.title' },
    })) as { items: CustomApiItem[] };
    expect(data.items).toHaveLength(1);
  });

  it('parses JSON Lines when skip-json-validation is set', async () => {
    const ctx = makeCtx(async () =>
      new Response('{"title":"One"}\n{"title":"Two"}\n', { status: 200 }),
    );
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/stream',
      'skip-json-validation': true,
      options: { path: '$[*]', title: '$.title' },
    })) as { items: CustomApiItem[] };
    expect(data.items.map((i) => i.title)).toEqual(['One', 'Two']);
  });

  it('wraps a single JSON object under skip-json-validation', async () => {
    const ctx = makeCtx(async () =>
      new Response(JSON.stringify({ title: 'Solo' }), { status: 200 }),
    );
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'https://api.example.com/solo',
      'skip-json-validation': true,
      options: { path: '$', title: '$.title' },
    })) as { items: CustomApiItem[] };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Solo');
  });

  it('refuses insecure http urls unless allow-insecure is set', async () => {
    const ctx = makeCtx(async () => new Response('{}', { status: 200 }));
    await expect(
      customApiFetcher()(ctx, { type: 'custom-api', url: 'http://api.example.com/x' }),
    ).rejects.toThrow('allow-insecure');
    const data = (await customApiFetcher()(ctx, {
      type: 'custom-api',
      url: 'http://api.example.com/x',
      'allow-insecure': true,
      options: { path: '$' },
    })) as { items: CustomApiItem[] };
    expect(data.items).toHaveLength(1);
  });
});
