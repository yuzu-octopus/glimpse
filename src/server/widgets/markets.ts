import { marketsSchema } from "../../shared/widgets/keyed";
import type { Market, MarketSourceIssue, MarketsData } from "../../shared/widgets/payloads";
import { fetchJson, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

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
	Accept: "application/json",
	"User-Agent": "Mozilla/5.0 (compatible; glimpse/0.1)",
};

/** The status half of a fetch error: `HTTP 500` or `HTTP fetch failed` — never
 * the URL, which is the same for every configured symbol, says nothing the
 * row does not, and wraps three lines in a 340px card. */
function shortReason(reason: unknown): string {
	const message = reason instanceof Error ? reason.message : String(reason);
	return /^(HTTP fetch failed|HTTP \d+)/.exec(message)?.[1] ?? message;
}

registerWidget("markets", async (ctx, config) => {
	const cfg = marketsSchema.parse(config);
	const retry = retryOptionsFrom(cfg);

	const settled = await Promise.allSettled(
		cfg.markets.map(async (m) => {
			const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(m.symbol)}?range=1mo&interval=1d`;
			const payload = await fetchJson<YahooChartResponse>(
				ctx,
				url,
				{
					headers: YAHOO_HEADERS,
				},
				retry,
			);
			const meta = payload.chart?.result?.[0]?.meta ?? {};
			const price = meta.regularMarketPrice ?? null;
			const prevClose = meta.chartPreviousClose;
			const change = price !== null && typeof prevClose === "number" ? price - prevClose : null;
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
	// A symbol Yahoo will not answer for is a per-source status, not a widget
	// failure — the symbols that did answer still render. Dropping the
	// rejection made a five-symbol config render a four-row card that reads as
	// complete, which is the silent partial loss the videos widget's `issues`
	// array exists to prevent.
	const issues: MarketSourceIssue[] = [];
	for (const [i, r] of settled.entries()) {
		if (r.status === "fulfilled") {
			markets.push(r.value);
		} else {
			issues.push({
				symbol: cfg.markets[i]?.symbol ?? "?",
				// `HTTP 500 for https://query1.finance.yahoo.com/v8/finance/chart/
				// BTC-USD?range=1mo&interval=1d` is the same sentence for every symbol
				// and wraps three lines in a 340px card. The symbol is already named
				// on the row, so keep the status and drop the URL.
				reason: shortReason(r.reason),
			});
		}
	}

	const sortBy = cfg["sort-by"] ?? "change";
	markets.sort((a, b) => {
		const av = a.change ?? 0;
		const bv = b.change ?? 0;
		return sortBy === "absolute-change" ? Math.abs(bv) - Math.abs(av) : bv - av;
	});
	return { markets, issues } satisfies MarketsData;
});
