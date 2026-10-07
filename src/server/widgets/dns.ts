import { dnsStatsSchema } from "../../shared/widgets/dns";
import type { DnsStats } from "../../shared/widgets/payloads";
import { sanitizeUrl } from "./http";
import { registerWidget } from "./registry";

const BARS = 8;
const HOURS_SPAN = 24;
const HOURS_PER_BAR = HOURS_SPAN / BARS; // 3

function trimRight(s: string, ch: string): string {
	let i = s.length;
	while (i > 0 && s[i - 1] === ch) i--;
	return s.slice(0, i);
}

function fmtLabel(d: Date): string {
	const h = d.getHours();
	const hour12 = ((h + 11) % 12) + 1;
	return `${hour12}${h < 12 ? "am" : "pm"}`;
}

function makeTimeLabels(): string[] {
	const now = Date.now();
	const labels: string[] = [];
	for (let h = HOURS_SPAN; h > 0; h -= HOURS_PER_BAR) {
		labels.push(fmtLabel(new Date(now - h * 3600_000)));
	}
	return labels;
}

function buildBars(
	queriesPerHour: number[],
	blockedPerHour: number[],
): Array<{ queries: number; blocked: number; percentBlocked: number; percentTotal: number }> {
	// pad/truncate to HOURS_SPAN from the right (most-recent window)
	let qs = queriesPerHour.slice();
	let bs = blockedPerHour.slice();
	if (qs.length > HOURS_SPAN) qs = qs.slice(qs.length - HOURS_SPAN);
	else if (qs.length < HOURS_SPAN) qs = [...Array(HOURS_SPAN - qs.length).fill(0), ...qs];
	if (bs.length > HOURS_SPAN) bs = bs.slice(bs.length - HOURS_SPAN);
	else if (bs.length < HOURS_SPAN) bs = [...Array(HOURS_SPAN - bs.length).fill(0), ...bs];

	const bars: Array<{
		queries: number;
		blocked: number;
		percentBlocked: number;
		percentTotal: number;
	}> = [];
	let maxQ = 0;
	for (let i = 0; i < BARS; i++) {
		let q = 0;
		let b = 0;
		for (let j = 0; j < HOURS_PER_BAR; j++) {
			q += qs[i * HOURS_PER_BAR + j] ?? 0;
			b += bs[i * HOURS_PER_BAR + j] ?? 0;
		}
		if (q > maxQ) maxQ = q;
		bars.push({
			queries: q,
			blocked: b,
			percentBlocked: q > 0 ? Math.round((b / q) * 100) : 0,
			percentTotal: 0,
		});
	}
	for (const bar of bars) {
		bar.percentTotal = maxQ > 0 ? Math.round((bar.queries / maxQ) * 100) : 0;
	}
	return bars;
}

async function fetchAdguard(
	ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
	base: string,
	username: string,
	password: string,
	hideGraph: boolean,
	hideTopDomains: boolean,
): Promise<DnsStats> {
	const url = `${trimRight(base, "/")}/control/stats`;
	const headers: Record<string, string> = {};
	if (username || password) headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
	const res = await ctx.fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
	if (!res.ok) throw new Error(`AdGuard stats HTTP ${res.status} for ${sanitizeUrl(url)}`);
	const j = (await res.json()) as {
		num_dns_queries: number;
		dns_queries: number[];
		num_blocked_filtering: number;
		blocked_filtering: number[];
		avg_processing_time: number;
		top_blocked_domains?: Array<Record<string, number>>;
	};
	const totalQueries = j.num_dns_queries ?? 0;
	const blockedQueries = j.num_blocked_filtering ?? 0;
	const blockedPercent = totalQueries > 0 ? Math.round((blockedQueries / totalQueries) * 100) : 0;
	const responseTime = Math.round((j.avg_processing_time ?? 0) * 1000);
	const series = hideGraph ? [] : buildBars(j.dns_queries ?? [], j.blocked_filtering ?? []);
	const topBlockedDomains: DnsStats["topBlockedDomains"] = [];
	if (!hideTopDomains && j.top_blocked_domains) {
		for (const m of j.top_blocked_domains.slice(0, 5)) {
			const domain = Object.keys(m)[0] ?? "";
			if (!domain) continue;
			const count = m[domain] ?? 0;
			topBlockedDomains.push({
				domain,
				percentBlocked: blockedQueries > 0 ? Math.round((count / blockedQueries) * 100) : 0,
			});
		}
	}
	return {
		totalQueries,
		blockedPercent,
		responseTime,
		domainsBlocked: 0,
		series,
		timeLabels: makeTimeLabels(),
		topBlockedDomains,
	};
}

async function fetchPiholeV5(
	ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
	base: string,
	token: string,
	hideGraph: boolean,
	hideTopDomains: boolean,
): Promise<DnsStats> {
	if (!token) throw new Error("missing API token for Pi-hole v5");
	const url = `${trimRight(base, "/")}/admin/api.php?summaryRaw&topItems&overTimeData10mins&auth=${encodeURIComponent(token)}`;
	const res = await ctx.fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!res.ok) throw new Error(`Pi-hole v5 HTTP ${res.status} for ${sanitizeUrl(url)}`);
	const j = (await res.json()) as {
		dns_queries_today: number;
		ads_blocked_today: number;
		ads_percentage_today: number;
		domains_being_blocked: number;
		domains_over_time?: Record<string, number> | unknown[];
		ads_over_time?: Record<string, number>;
		top_ads?: Record<string, number> | unknown[];
	};
	const totalQueries = j.dns_queries_today ?? 0;
	const blockedPercent = Math.round(j.ads_percentage_today ?? 0);
	const domainsBlocked = j.domains_being_blocked ?? 0;

	let topBlockedDomains: DnsStats["topBlockedDomains"] = [];
	if (!hideTopDomains) {
		const raw = j.top_ads && !Array.isArray(j.top_ads) ? (j.top_ads as Record<string, number>) : {};
		const entries = Object.entries(raw).map(([domain, count]) => ({
			domain,
			percentBlocked:
				(j.ads_blocked_today ?? 0) > 0 ? Math.round((count / j.ads_blocked_today) * 100) : 0,
		}));
		entries.sort((a, b) => b.percentBlocked - a.percentBlocked);
		topBlockedDomains = entries.slice(0, 5);
	}

	let series: DnsStats["series"] = [];
	if (!hideGraph) {
		const qsRaw =
			j.domains_over_time && !Array.isArray(j.domains_over_time)
				? (j.domains_over_time as Record<string, number>)
				: {};
		const bsRaw = (j.ads_over_time as Record<string, number>) ?? {};
		const qKeys = Object.keys(qsRaw)
			.map(Number)
			.sort((a, b) => a - b);
		const bKeys = Object.keys(bsRaw)
			.map(Number)
			.sort((a, b) => a - b);
		// expect 144 points each; gracefully degrade to empty when not
		if (qKeys.length === 144 && bKeys.length === 144) {
			const qVals = qKeys.map((k) => qsRaw[String(k)] ?? 0);
			const bVals = bKeys.map((k) => bsRaw[String(k)] ?? 0);
			// aggregate 144 -> 8 bars of 18 points (glance), then via hourly helper:
			// convert 144 ten-min points -> 24 hourly (6 per hour) -> then bars helper
			const qHourly: number[] = [];
			const bHourly: number[] = [];
			for (let h = 0; h < 24; h++) {
				let q = 0;
				let b = 0;
				for (let p = 0; p < 6; p++) {
					q += qVals[h * 6 + p] ?? 0;
					b += bVals[h * 6 + p] ?? 0;
				}
				qHourly.push(q);
				bHourly.push(b);
			}
			series = buildBars(qHourly, bHourly);
		}
	}

	return {
		totalQueries,
		blockedPercent,
		responseTime: 0,
		domainsBlocked,
		series,
		timeLabels: makeTimeLabels(),
		topBlockedDomains,
	};
}

/** A URL embedded in third-party prose. Excludes whitespace and the
 * delimiters that normally surround one, so trailing prose stays out. */
const EMBEDDED_URL = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'`<>()[\],;]+/gi;
/** Control characters, including the newlines a Banner must never render. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars IS the job — the range is the point
const CONTROL = /[\s\x00-\x1f\x7f]+/g;
/** Cap on a single reason. The docs' hint is one short sentence; anything
 * far past this is a server bug, not a diagnosis. */
const MAX_REASON = 160;

/** FTL's `hint` and `message` are server-supplied free text from a third
 * party, and the reason they end up in reaches the browser, the page cache
 * and the service worker's Cache Storage (see AGENTS.md). Flatten to one
 * line, cap the length so a huge hint cannot flood the Banner, and
 * `sanitizeUrl` every embedded URL — a query string there can carry a
 * session id or a token. Sanitizing happens *before* the cap, so
 * truncation can never re-expose a query the sanitizer already removed.
 * Non-URL prose is left alone: `sanitizeUrl`'s USERINFO strip would eat
 * everything up to an `@`, mangling an ordinary sentence. */
function safeReason(text: string): string {
	const one = text
		.replace(CONTROL, " ")
		.replace(EMBEDDED_URL, (u) => sanitizeUrl(u))
		.trim();
	return one.length > MAX_REASON ? `${one.slice(0, MAX_REASON - 1).trimEnd()}…` : one;
}

/** FTL wraps every v6 failure in `{ error: { key, message, hint }, took }`
 * (docs.pi-hole.net/api/auth) — an object, never a string. Prefer `hint`:
 * it is where FTL puts the actionable part, and the docs' own example is
 * "The API is hosted at pi.hole/api, not pi.hole/admin/api". Fall back to
 * `message`, which is usually just a restatement of the status
 * ("Unauthorized"). `key` is redundant with the status the message already
 * carries, so it never reaches the Banner. Anything that is not the
 * documented shape yields null and the bare status stands on its own. */
function v6Reason(body: unknown): string | null {
	const error = (body as { error?: unknown } | null)?.error;
	if (!error || typeof error !== "object") return null;
	const { hint, message } = error as { hint?: unknown; message?: unknown };
	return (
		(typeof hint === "string" ? safeReason(hint) : "") ||
		(typeof message === "string" ? safeReason(message) : "") ||
		null
	);
}

/** Every v6 endpoint reports failure this way, so auth and summary build
 * the message identically. A body that is absent, not JSON, or not the
 * documented envelope leaves the message exactly as it was — the status is
 * still true, and a parse failure must never mask the error it explains. */
async function v6HttpError(res: Response, what: string): Promise<Error> {
	let reason: string | null = null;
	try {
		reason = v6Reason(await res.json());
	} catch {
		// No JSON body at all: a reverse proxy's HTML error page, an empty 502.
	}
	return new Error(`Pi-hole v6 ${what} HTTP ${res.status}${reason ? `: ${reason}` : ""}`);
}

async function fetchPiholeV6(
	ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
	base: string,
	password: string,
	hideGraph: boolean,
	hideTopDomains: boolean,
): Promise<DnsStats> {
	const root = trimRight(base, "/");
	// auth
	const authRes = await ctx.fetch(`${root}/api/auth`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password }),
		signal: AbortSignal.timeout(15_000),
	});
	if (!authRes.ok) throw await v6HttpError(authRes, "auth");
	const authJson = (await authRes.json()) as { session?: { sid?: string } };
	const sid = authJson.session?.sid;
	if (!sid) {
		// Same envelope, no status to lean on: `missing sid` on its own leaves
		// the user with nothing to act on.
		const reason = v6Reason(authJson);
		throw new Error(`Pi-hole v6 auth: missing sid${reason ? `: ${reason}` : ""}`);
	}

	const sidHeader = { "x-ftl-sid": sid } as Record<string, string>;

	const summaryRes = await ctx.fetch(`${root}/api/stats/summary`, {
		headers: sidHeader,
		signal: AbortSignal.timeout(15_000),
	});
	if (!summaryRes.ok) throw await v6HttpError(summaryRes, "summary");
	const summary = (await summaryRes.json()) as {
		queries: { total: number; blocked: number; percent_blocked: number };
		gravity: { domains_being_blocked: number };
		took?: number;
	};

	const [histRes, topRes] = await Promise.all([
		!hideGraph
			? ctx
					.fetch(`${root}/api/history`, { headers: sidHeader, signal: AbortSignal.timeout(15_000) })
					.catch(() => null)
			: Promise.resolve(null),
		!hideTopDomains
			? ctx
					.fetch(`${root}/api/stats/top_domains?blocked=true`, {
						headers: sidHeader,
						signal: AbortSignal.timeout(15_000),
					})
					.catch(() => null)
			: Promise.resolve(null),
	]);

	let series: DnsStats["series"] = [];
	if (histRes?.ok) {
		const hist = (await histRes.json()) as {
			history: Array<{ timestamp: number; total: number; blocked: number }>;
		};
		const h = hist.history ?? [];
		const sliced = h.length === 145 ? h.slice(1) : h;
		if (sliced.length === 144) {
			const qHourly: number[] = [];
			const bHourly: number[] = [];
			for (let hour = 0; hour < 24; hour++) {
				let q = 0;
				let b = 0;
				for (let p = 0; p < 6; p++) {
					const idx = hour * 6 + p;
					q += sliced[idx]?.total ?? 0;
					b += sliced[idx]?.blocked ?? 0;
				}
				qHourly.push(q);
				bHourly.push(b);
			}
			series = buildBars(qHourly, bHourly);
		}
	}

	let topBlockedDomains: DnsStats["topBlockedDomains"] = [];
	if (topRes?.ok) {
		const tj = (await topRes.json()) as { domains: Array<{ domain: string; count: number }> };
		const blocked = summary.queries?.blocked ?? 0;
		const raw = (tj.domains ?? []).slice(0, 5).map((d) => ({
			domain: d.domain,
			percentBlocked: blocked > 0 ? Math.round((d.count / blocked) * 100) : 0,
		}));
		raw.sort((a, b) => b.percentBlocked - a.percentBlocked);
		topBlockedDomains = raw;
	}

	// responseTime: pihole summary has no latency; keep 0 so UI shows DOMAINS
	// For completeness, if `took` is present in summary top-domains it is query time, not DNS latency.
	return {
		totalQueries: summary.queries?.total ?? 0,
		blockedPercent: Math.round(summary.queries?.percent_blocked ?? 0),
		responseTime: 0,
		domainsBlocked: summary.gravity?.domains_being_blocked ?? 0,
		series,
		timeLabels: makeTimeLabels(),
		topBlockedDomains,
	};
}

async function fetchTechnitium(
	ctx: Parameters<Parameters<typeof registerWidget>[1]>[0],
	base: string,
	token: string,
	hideGraph: boolean,
	hideTopDomains: boolean,
): Promise<DnsStats> {
	if (!token) throw new Error("missing API token for Technitium");
	const url = `${trimRight(base, "/")}/api/dashboard/stats/get?token=${encodeURIComponent(token)}&type=LastDay`;
	const res = await ctx.fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!res.ok) throw new Error(`Technitium HTTP ${res.status} for ${sanitizeUrl(url)}`);
	const j = (await res.json()) as {
		response: {
			stats: {
				totalQueries: number;
				blockedQueries: number;
				blockedZones?: number;
				blockListZones?: number;
			};
			mainChartData?: { datasets: Array<{ label: string; data: number[] }> };
			topBlockedDomains?: Array<{ domainName: string; hits: number }>;
			topBlockedDomains_alt?: Array<{ domain: string; count: number }>;
		};
	};
	const st = j.response?.stats ?? { totalQueries: 0, blockedQueries: 0 };
	const totalQueries = st.totalQueries ?? 0;
	const blockedQueries = st.blockedQueries ?? 0;
	const blockedPercent = totalQueries > 0 ? Math.round((blockedQueries / totalQueries) * 100) : 0;
	const domainsBlocked = (st.blockedZones ?? 0) + (st.blockListZones ?? 0);

	let series: DnsStats["series"] = [];
	if (!hideGraph && j.response?.mainChartData?.datasets) {
		let qSeries: number[] = [];
		let bSeries: number[] = [];
		for (const ds of j.response.mainChartData.datasets) {
			if (ds.label === "Total") qSeries = ds.data ?? [];
			if (ds.label === "Blocked") bSeries = ds.data ?? [];
		}
		series = buildBars(qSeries, bSeries);
	}

	let topBlockedDomains: DnsStats["topBlockedDomains"] = [];
	if (!hideTopDomains) {
		// Technitium shape varies: prefer topBlockedDomains, fallback to alternate
		const rawDomains: Array<{ domain: string; count: number }> =
			((j.response as unknown as { topBlockedDomains?: Array<{ domain: string; count: number }> })
				.topBlockedDomains as Array<{ domain: string; count: number }>) ??
			(j.response.topBlockedDomains as unknown as Array<{ domain: string; count: number }>) ??
			[];
		// also handle {domainName, hits}
		const alt = (
			j.response as unknown as { topBlockedDomains?: Array<{ domainName: string; hits: number }> }
		).topBlockedDomains as unknown as Array<{
			domainName: string;
			hits: number;
		}>;
		let normalized: Array<{ domain: string; count: number }> = rawDomains;
		if (
			(!rawDomains || rawDomains.length === 0) &&
			Array.isArray(alt) &&
			alt.length > 0 &&
			"domainName" in alt[0]
		) {
			normalized = (alt as Array<{ domainName: string; hits: number }>)
				.slice(0, 5)
				.map((d) => ({ domain: d.domainName, count: d.hits }));
		} else {
			normalized = (rawDomains ?? []).slice(0, 5);
		}
		topBlockedDomains = normalized.map((d) => ({
			domain: d.domain,
			percentBlocked: blockedQueries > 0 ? Math.round((d.count / blockedQueries) * 100) : 0,
		}));
	}

	return {
		totalQueries,
		blockedPercent,
		responseTime: 0,
		domainsBlocked,
		series,
		timeLabels: makeTimeLabels(),
		topBlockedDomains,
	};
}

registerWidget("dns-stats", async (ctx, config) => {
	const cfg = dnsStatsSchema.parse(config);
	const base = cfg.url;
	const hideGraph = cfg["hide-graph"] ?? false;
	const hideTopDomains = cfg["hide-top-domains"] ?? false;
	const service = cfg.service ?? "pihole";
	if (service === "adguard") {
		return fetchAdguard(
			ctx,
			base,
			ctx.env.ADGUARD_USERNAME ?? "",
			ctx.env.ADGUARD_PASSWORD ?? "",
			hideGraph,
			hideTopDomains,
		);
	}
	if (service === "technitium") {
		return fetchTechnitium(ctx, base, ctx.env.TECHNITIUM_TOKEN ?? "", hideGraph, hideTopDomains);
	}
	// pihole (v6 with session when password present, fallback to v5)
	const password = ctx.env.PIHOLE_PASSWORD;
	const token = ctx.env.PIHOLE_TOKEN;
	if (password) {
		try {
			return await fetchPiholeV6(ctx, base, password, hideGraph, hideTopDomains);
		} catch (v6Error) {
			// Fallback to v5 when token available; else propagate v6 error
			if (!token) throw v6Error;
			try {
				return await fetchPiholeV5(ctx, base, token, hideGraph, hideTopDomains);
			} catch (v5Error) {
				// v5 is the degraded second attempt, so its status is the *later*
				// fact: reporting it alone leaves the user with no idea the v6 path
				// broke first. api.ts copies `e.message` and nothing else into
				// `payload.error`, so the v6 cause has to ride in the message — an
				// Error `cause` chain would be dropped before the Banner ever sees it.
				// Both halves are widget-local and already sanitized: the v6 one
				// carries a status plus an FTL reason run through `safeReason`, the
				// v5 one a `sanitizeUrl`-ed URL. Each stays a single clause, so the
				// `;` join reads as two facts rather than one garbled sentence.
				const v6Why = v6Error instanceof Error ? v6Error.message : String(v6Error);
				const v5Why = v5Error instanceof Error ? v5Error.message : String(v5Error);
				throw new Error(`${v6Why}; the v5 fallback failed too: ${v5Why}`, { cause: v6Error });
			}
		}
	}
	return fetchPiholeV5(ctx, base, token ?? "", hideGraph, hideTopDomains);
});
