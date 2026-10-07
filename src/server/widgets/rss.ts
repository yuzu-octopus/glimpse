import { rssSchema } from "../../shared/widgets/feeds";
import type { RssItem } from "../../shared/widgets/payloads";
import { fetchText, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";
import { getBXML } from "./xml";

function asArray<T>(v: T | T[] | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

function textVal(v: unknown): string | undefined {
	if (typeof v === "string") return v;
	if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
		const t = (v as Record<string, unknown>)["#text"];
		if (typeof t === "string") return t;
	}
	return undefined;
}

function linkVal(v: unknown): string | undefined {
	if (typeof v === "string") return v;
	if (v && typeof v === "object") {
		const o = v as Record<string, unknown>;
		if (typeof o["@href"] === "string") return o["@href"] as string;
		if (typeof o["#text"] === "string") return o["#text"] as string;
		if (typeof o.href === "string") return o.href as string;
	}
	return undefined;
}

function extractThumbnail(item: Record<string, unknown>): string | null {
	const mt = item["media:thumbnail"] as unknown;
	if (mt && typeof mt === "object") {
		const o = mt as Record<string, unknown>;
		if (typeof o["@url"] === "string") return o["@url"] as string;
	}
	const enc = item.enclosure as unknown;
	if (enc && typeof enc === "object") {
		const o = enc as Record<string, unknown>;
		if (typeof o["@url"] === "string") return o["@url"] as string;
	}
	return null;
}

function extractCategories(item: Record<string, unknown>): string[] {
	const cats: string[] = [];
	const raw = item.category ?? item.categories;
	for (const c of asArray(raw as unknown)) {
		if (typeof c === "string") cats.push(c);
		else if (c && typeof c === "object") {
			const o = c as Record<string, unknown>;
			if (typeof o["@term"] === "string") cats.push(o["@term"] as string);
			else if (typeof o["#text"] === "string") cats.push(o["#text"] as string);
			else if (typeof o.term === "string") cats.push(o.term as string);
		}
	}
	return cats;
}

/** Feed descriptions are HTML but the client renders plain text. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
	mdash: "—",
	ndash: "–",
	hellip: "…",
	nbsp: " ",
	copy: "©",
	reg: "®",
	trade: "™",
	laquo: "«",
	raquo: "»",
	bull: "•",
	deg: "°",
	plusmn: "±",
	frac12: "½",
	frac14: "¼",
	frac34: "¾",
	times: "×",
	divide: "÷",
	micro: "µ",
	para: "¶",
	sect: "§",
	dagger: "†",
	Dagger: "‡",
	permil: "‰",
	prime: "′",
	Prime: "″",
	euro: "€",
	pound: "£",
	yen: "¥",
	cent: "¢",
	curren: "¤",
	brvbar: "¦",
	uml: "¨",
	ordf: "ª",
	ordm: "º",
	iexcl: "¡",
	iquest: "¿",
	szlig: "ß",
	agrave: "à",
	aacute: "á",
	acirc: "â",
	atilde: "ã",
	auml: "ä",
	aring: "å",
	aelig: "æ",
	ccedil: "ç",
	egrave: "è",
	eacute: "é",
	ecirc: "ê",
	euml: "ë",
	igrave: "ì",
	iacute: "í",
	icirc: "î",
	iuml: "ï",
	eth: "ð",
	ntilde: "ñ",
	ograve: "ò",
	oacute: "ó",
	ocirc: "ô",
	otilde: "õ",
	ouml: "ö",
	oslash: "ø",
	ugrave: "ù",
	uacute: "ú",
	ucirc: "û",
	uuml: "ü",
	yacute: "ý",
	thorn: "þ",
	yuml: "ÿ",
	Agrave: "À",
	Aacute: "Á",
	Acirc: "Â",
	Atilde: "Ã",
	Auml: "Ä",
	Aring: "Å",
	AElig: "Æ",
	Ccedil: "Ç",
	Egrave: "È",
	Eacute: "É",
	Ecirc: "Ê",
	Euml: "Ë",
	Igrave: "Ì",
	Iacute: "Í",
	Icirc: "Î",
	Iuml: "Ï",
	ETH: "Ð",
	Ntilde: "Ñ",
	Ograve: "Ò",
	Oacute: "Ó",
	Ocirc: "Ô",
	Otilde: "Õ",
	Ouml: "Ö",
	Oslash: "Ø",
	Ugrave: "Ù",
	Uacute: "Ú",
	Ucirc: "Û",
	Uuml: "Ü",
	Yacute: "Ý",
	THORN: "Þ",
	alpha: "α",
	beta: "β",
	gamma: "γ",
	delta: "δ",
	epsilon: "ε",
	pi: "π",
	sigma: "σ",
	omega: "ω",
	Omega: "Ω",
	infin: "∞",
	ne: "≠",
	le: "≤",
	ge: "≥",
	larr: "←",
	uarr: "↑",
	rarr: "→",
	darr: "↓",
	harr: "↔",
	crarr: "↵",
	lArr: "⇐",
	uArr: "⇑",
	rArr: "⇒",
	dArr: "⇓",
	hArr: "⇔",
	forall: "∀",
	part: "∂",
	exist: "∃",
	empty: "∅",
	nabla: "∇",
	isin: "∈",
	notin: "∉",
	ni: "∋",
	prod: "∏",
	sum: "∑",
	minus: "−",
	radic: "√",
	prop: "∝",
	ang: "∠",
	and: "∧",
	or: "∨",
	cap: "∩",
	cup: "∪",
	int: "∫",
	there4: "∴",
	sim: "∼",
	cong: "≅",
	asymp: "≈",
	equiv: "≡",
	sub: "⊂",
	sup: "⊃",
	nsub: "⊄",
	sube: "⊆",
	supe: "⊇",
	oplus: "⊕",
	otimes: "⊗",
	perp: "⊥",
	sdot: "⋅",
	loz: "◊",
	spades: "♠",
	clubs: "♣",
	hearts: "♥",
	diams: "♦",
};

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
			if (entity.startsWith("#x") || entity.startsWith("#X")) {
				const code = parseInt(entity.slice(2), 16);
				return isNaN(code) ? match : String.fromCodePoint(code);
			}
			if (entity.startsWith("#")) {
				const code = parseInt(entity.slice(1), 10);
				return isNaN(code) ? match : String.fromCodePoint(code);
			}
			return NAMED_ENTITIES[entity] ?? match;
		})
		.replace(/\s+/g, " ")
		.trim();
}

function parseFeed(raw: string): { title?: string; items: Array<Record<string, unknown>> } {
	const parsed = getBXML().parse(raw) as Record<string, unknown>;
	const rss = parsed.rss as Record<string, unknown> | undefined;
	if (rss) {
		const channel = rss.channel as Record<string, unknown> | undefined;
		if (channel) {
			const title = textVal(channel.title);
			const items = asArray(channel.item as unknown).map((it) => it as Record<string, unknown>);
			return { title, items };
		}
	}
	const feed = parsed.feed as Record<string, unknown> | undefined;
	if (feed) {
		const title = textVal(feed.title);
		const entries = asArray(feed.entry as unknown).map((e) => e as Record<string, unknown>);
		return { title, items: entries };
	}
	return { title: undefined, items: [] };
}

function itemTitle(item: Record<string, unknown>): string {
	return textVal(item.title) ?? "";
}

function itemLink(item: Record<string, unknown>): string {
	const raw = item.link;
	if (typeof raw === "string") return raw;
	if (Array.isArray(raw)) {
		for (const l of raw) {
			const v = linkVal(l);
			if (v) return v;
		}
		return "";
	}
	const v = linkVal(raw);
	if (v) return v;
	return "";
}

function itemPublished(item: Record<string, unknown>): string | null {
	return (
		textVal(item.isoDate) ??
		textVal(item.pubDate) ??
		textVal(item.published) ??
		textVal(item.updated) ??
		textVal(item.pubdate) ??
		null
	);
}

function itemDescription(item: Record<string, unknown>): string | null {
	const raw =
		textVal(item.description) ??
		textVal(item.summary) ??
		textVal(item.content) ??
		(typeof item["content:encoded"] === "string"
			? (item["content:encoded"] as string)
			: textVal(item["content:encoded"])) ??
		textVal(item["media:description"]);
	if (!raw) return null;
	const stripped = stripHtml(raw);
	return stripped || null;
}

registerWidget("rss", async (ctx, config) => {
	const cfg = rssSchema.parse(config);
	const settled = await Promise.allSettled(
		cfg.feeds.map(async (feed) => {
			const raw = await fetchText(ctx, feed.url, { headers: feed.headers }, retryOptionsFrom(cfg));
			const parsed = parseFeed(raw);
			// glance widget-rss.go:253 — a configured prefix replaces the link
			// outright, which is the escape hatch for feeds that emit bare paths.
			const linkPrefix = feed["item-link-prefix"];
			const perFeedLimit = feed.limit ?? cfg.limit;
			const slice = parsed.items.slice(0, perFeedLimit);
			return slice.map((item) => ({
				title: itemTitle(item),
				url: linkPrefix ? linkPrefix + itemLink(item) : itemLink(item),
				published: itemPublished(item),
				source: feed.title ?? parsed.title ?? "",
				thumbnail: extractThumbnail(item),
				description: feed["hide-description"] ? null : itemDescription(item),
				categories: feed["hide-categories"] ? [] : extractCategories(item),
			})) as RssItem[];
		}),
	);
	const failed = settled.filter((r) => r.status === "rejected");
	if (failed.length === cfg.feeds.length) {
		throw new Error("all RSS feeds failed to load");
	}
	const items: RssItem[] = [];
	for (const r of settled) {
		if (r.status === "fulfilled") items.push(...r.value);
	}
	if (!cfg["preserve-order"]) {
		items.sort((a, b) => {
			const ta = a.published ? Date.parse(a.published) : 0;
			const tb = b.published ? Date.parse(b.published) : 0;
			return tb - ta;
		});
	}
	return { items: items.slice(0, cfg.limit) };
});
