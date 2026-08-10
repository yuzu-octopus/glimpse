import { marketsSchema } from '../../shared/widgets/keyed';
import { fetchJson } from './http';
import { registerWidget } from './registry';

export interface Market {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  chart: number[];
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
      };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
  };
}

const YAHOO_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; glimpse/0.1)',
};

registerWidget('markets', async (ctx, config) => {
  const cfg = marketsSchema.parse(config);

  const settled = await Promise.allSettled(
    cfg.markets.map(async (m) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(m.symbol)}?range=1mo&interval=1d`;
      const payload = await fetchJson<YahooChartResponse>(ctx, url, {
        headers: YAHOO_HEADERS,
      });
      const meta = payload.chart?.result?.[0]?.meta ?? {};
      const price = meta.regularMarketPrice ?? null;
      const prevClose = meta.chartPreviousClose;
      const change =
        price !== null && typeof prevClose === 'number' ? price - prevClose : null;
      const changePct = change !== null && prevClose ? (change / prevClose) * 100 : null;
      const closes = (payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(
        (c): c is number => c !== null && c !== undefined,
      );
      return {
        symbol: m.symbol,
        name: m.name ?? m.symbol,
        price,
        change,
        changePct,
        chart: closes.slice(-21),
      } as Market;
    }),
  );

  const markets: Market[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') markets.push(r.value);
  }

  const sortBy = cfg['sort-by'] ?? 'change';
  markets.sort((a, b) => {
    const av = a.change ?? 0;
    const bv = b.change ?? 0;
    return sortBy === 'absolute-change' ? Math.abs(bv) - Math.abs(av) : bv - av;
  });
  return { markets };
});
