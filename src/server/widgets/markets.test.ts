import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './markets';
import type { Market } from './markets';

function chartPayload(price: number, prevClose: number, closes: (number | null)[]) {
  return {
    chart: {
      result: [
        {
          meta: { regularMarketPrice: price, chartPreviousClose: prevClose },
          indicators: { quote: [{ close: closes }] },
        },
      ],
    },
  };
}

function makeCtx(routes: Record<string, unknown>): WidgetFetchContext {
  const fetchImpl = async (url: string) => {
    const hit = routes[url];
    if (hit === undefined) return new Response('{"error":"not found"}', { status: 404 });
    return new Response(JSON.stringify(hit), { status: 200 });
  };
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const URL = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;

const marketsFetcher = () => serverWidgets.get('markets')!;

describe('markets fetcher', () => {
  it('maps price, change, pct and last 21 chart points', async () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const ctx = makeCtx({
      [URL('AAPL')]: chartPayload(125, 100, closes),
    });
    const data = (await marketsFetcher()(ctx, {
      type: 'markets',
      markets: [{ symbol: 'AAPL', name: 'Apple' }],
    })) as { markets: Market[] };
    const m = data.markets[0];
    expect(m.name).toBe('Apple');
    expect(m.price).toBe(125);
    expect(m.change).toBe(25);
    expect(m.changePct).toBe(25);
    expect(m.chart).toHaveLength(21);
    expect(m.chart[0]).toBe(104); // last 21 of 25 values
  });

  it('falls back to symbol name and nulls change when prevClose is missing', async () => {
    const ctx = makeCtx({
      [URL('MSFT')]: { chart: { result: [{ meta: { regularMarketPrice: 90 }, indicators: { quote: [{ close: [1, 2] }] } }] } },
    });
    const data = (await marketsFetcher()(ctx, {
      type: 'markets',
      markets: [{ symbol: 'MSFT' }],
    })) as { markets: Market[] };
    expect(data.markets[0].name).toBe('MSFT');
    expect(data.markets[0].price).toBe(90);
    expect(data.markets[0].change).toBeNull();
    expect(data.markets[0].changePct).toBeNull();
    expect(data.markets[0].chart).toEqual([1, 2]);
  });

  it('drops null closes and sorts by absolute change', async () => {
    const ctx = makeCtx({
      [URL('A')]: chartPayload(120, 100, [1, null, 3]),
      [URL('B')]: chartPayload(50, 100, [1]),
      [URL('C')]: chartPayload(105, 100, [1]),
    });
    const data = (await marketsFetcher()(ctx, {
      type: 'markets',
      markets: [{ symbol: 'A' }, { symbol: 'B' }, { symbol: 'C' }],
      'sort-by': 'absolute-change',
    })) as { markets: Market[] };
    expect(data.markets.map((m) => m.symbol)).toEqual(['B', 'A', 'C']);
    expect(data.markets.find((m) => m.symbol === 'A')!.chart).toEqual([1, 3]); // nulls dropped
  });

  it('sorts by change descending by default', async () => {
    const ctx = makeCtx({
      [URL('UP')]: chartPayload(110, 100, [1]),
      [URL('DOWN')]: chartPayload(90, 100, [1]),
    });
    const data = (await marketsFetcher()(ctx, {
      type: 'markets',
      markets: [{ symbol: 'DOWN' }, { symbol: 'UP' }],
    })) as { markets: Market[] };
    expect(data.markets.map((m) => m.symbol)).toEqual(['UP', 'DOWN']);
  });
});
