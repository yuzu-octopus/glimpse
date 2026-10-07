import { githubTrendingSchema, TRENDING_DEFAULTS } from "../../shared/widgets/github-trending";
import type { TrendingData, TrendingRepo } from "../../shared/widgets/payloads";
import { fetchText, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

function parseTrending(html: string, limit: number): TrendingRepo[] {
	const repos: TrendingRepo[] = [];
	const articleRe = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
	let m: RegExpExecArray | null;
	m = articleRe.exec(html);
	while (m !== null && repos.length < limit) {
		const block = m[1];
		const hrefM = block.match(/href="\/([^"]+)"/);
		if (!hrefM) {
			m = articleRe.exec(html);
			continue;
		}
		const fullName = hrefM[1].split('"')[0].trim();
		const descM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
		const description = descM ? descM[1].replace(/<[^>]+>/g, "").trim() || undefined : undefined;
		const langM = block.match(/programmingLanguage[^>]*>([^<]+)</);
		const language = langM ? langM[1].trim() || undefined : undefined;
		const starsM = block.match(/(\d[\d,]*)\s*stars?/i);
		const stars = starsM ? Number(starsM[1].replace(/,/g, "")) : 0;
		const todayM = block.match(/(\d[\d,]*)\s+stars? today/i);
		const starsToday = todayM ? Number(todayM[1].replace(/,/g, "")) : 0;
		repos.push({
			fullName,
			description,
			language,
			stars,
			starsToday,
			url: `https://github.com/${fullName}`,
		});
		m = articleRe.exec(html);
	}
	return repos;
}

registerWidget("github-trending", async (ctx, cfg) => {
	const c = githubTrendingSchema.parse(cfg);
	const lang = c.language ? `/${encodeURIComponent(c.language)}` : "";
	const since = c.since ?? TRENDING_DEFAULTS.since;
	const limit = c.limit ?? TRENDING_DEFAULTS.limit;
	const html = await fetchText(
		ctx,
		`https://github.com/trending${lang}?since=${since}`,
		{},
		retryOptionsFrom(c),
	);
	const data: TrendingData = parseTrending(html, limit);
	return data;
});

export { parseTrending };
