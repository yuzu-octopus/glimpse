import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./change-detection";
import { extractBySelector, hashContent, toComparableText } from "./change-detection";

function makeCtx(
	htmlByUrl: Record<string, string>,
	failUrls: string[] = [],
): {
	ctx: WidgetFetchContext;
	fetchMock: ReturnType<typeof vi.fn>;
} {
	const fetchMock = vi.fn(async (url: string) => {
		if (failUrls.includes(url)) throw new Error("network down");
		return new Response(htmlByUrl[url] ?? "<html><body>empty</body></html>");
	});
	return {
		ctx: {
			fetch: fetchMock as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		},
		fetchMock,
	};
}

const fetcher = () => serverWidgets.get("change-detection")!;
const URL = "https://example.com/prices";

describe("change-detection fetcher", () => {
	it("reports unchanged on first sight, then detects a change with a snippet", async () => {
		const { ctx } = makeCtx({ [URL]: "<html><body><p>price: $10</p></body></html>" });
		const cfg = { type: "change-detection", urls: [URL] };
		await expect(fetcher()(ctx, cfg)).resolves.toEqual([
			{ url: URL, changed: false, changedAt: null },
		]);
		await expect(fetcher()(ctx, cfg)).resolves.toEqual([
			{ url: URL, changed: false, changedAt: null },
		]);

		const { ctx: ctx2 } = makeCtx({ [URL]: "<html><body><p>price: $12</p></body></html>" });
		// Share the stored hash across polls via the first context's cache.
		const prev = ctx.cache.get<{ hash: string; changedAt: string | null }>(
			`change-detection:${URL}:`,
		)!;
		ctx2.cache.set(`change-detection:${URL}:`, prev, 1000);
		const changed = (await fetcher()(ctx2, cfg)) as Array<{
			url: string;
			changed: boolean;
			changedAt: string | null;
			diffSnippet?: string;
		}>;
		expect(changed).toHaveLength(1);
		expect(changed[0].url).toBe(URL);
		expect(changed[0].changed).toBe(true);
		expect(changed[0].changedAt).toEqual(expect.any(String));
		expect(changed[0].diffSnippet).toContain("price: $12");
	});

	it("keeps the stored hash and prior changedAt on network error", async () => {
		// The test name promises two things and the naive version asserts neither:
		// `changedAt` is null for the whole run, and nothing checks that the hash
		// survived. A fetcher that dropped the cache entry in its catch would
		// report `unchanged` forever and never detect a real change again.
		const { ctx } = makeCtx({ [URL]: "<html><body>v1</body></html>" });
		const cfg = { type: "change-detection", urls: [URL] };
		await fetcher()(ctx, cfg);
		const key = `change-detection:${URL}:`;
		const seeded = ctx.cache.get<{ hash: string; changedAt: string | null }>(key)!;

		// Seed a prior detection so "prior changedAt" is something to preserve.
		const priorAt = "2026-01-02T03:04:05.000Z";
		const withPrior = { ...seeded, changedAt: priorAt };
		const { ctx: failing } = makeCtx({}, [URL]);
		// A long TTL: the failing poll burns real retry backoff before it returns,
		// so a 1s seed would be gone by the time the next poll reads it.
		failing.cache.set(key, withPrior, 3_600_000);
		await expect(fetcher()(failing, cfg)).resolves.toEqual([
			{ url: URL, changed: false, changedAt: priorAt },
		]);

		// The entry the failing poll left behind still carries v1's hash.
		const { ctx: after } = makeCtx({ [URL]: "<html><body>v1</body></html>" });
		after.cache.set(key, failing.cache.get(key), 3_600_000);
		await expect(fetcher()(after, cfg)).resolves.toEqual([
			{ url: URL, changed: false, changedAt: priorAt },
		]);

		// So the next real change is still detected rather than reported as the
		// first sight.
		const { ctx: changedCtx } = makeCtx({ [URL]: "<html><body>v2</body></html>" });
		changedCtx.cache.set(key, failing.cache.get(key), 3_600_000);
		const res = (await fetcher()(changedCtx, cfg)) as Array<{
			changed: boolean;
			changedAt: string | null;
			diffSnippet?: string;
		}>;
		expect(res[0].changed).toBe(true);
		expect(res[0].changedAt).toEqual(expect.any(String));
		expect(res[0].diffSnippet).toContain("v2");
	});

	it("watches only the selected element when selector is set", async () => {
		const page = (price: string, ad: string) =>
			`<html><body><main>price: ${price}</main><aside>ad: ${ad}</aside></body></html>`;
		const { ctx } = makeCtx({ [URL]: page("$10", "a1") });
		const cfg = { type: "change-detection", urls: [URL], selector: "main" };
		await fetcher()(ctx, cfg);
		// Outside the selector changes → still unchanged.
		const { ctx: ctx2 } = makeCtx({ [URL]: page("$10", "a2") });
		ctx2.cache.set(
			`change-detection:${URL}:main`,
			ctx.cache.get(`change-detection:${URL}:main`),
			1000,
		);
		await expect(fetcher()(ctx2, cfg)).resolves.toEqual([
			{ url: URL, changed: false, changedAt: null },
		]);
		// Inside the selector changes → changed.
		const { ctx: ctx3 } = makeCtx({ [URL]: page("$11", "a2") });
		ctx3.cache.set(
			`change-detection:${URL}:main`,
			ctx.cache.get(`change-detection:${URL}:main`),
			1000,
		);
		const res = (await fetcher()(ctx3, cfg)) as Array<{ changed: boolean }>;
		expect(res[0].changed).toBe(true);
	});

	it("requires at least one url", async () => {
		// A bare toThrow would pass on any crash; the contract is that the config
		// is rejected by the schema before a request goes out.
		const { ctx } = makeCtx({});
		await expect(fetcher()(ctx, { type: "change-detection", urls: [] })).rejects.toThrow(
			/Too small: expected array to have >=1 items/,
		);
	});
});

describe("change-detection helpers", () => {
	it("hashes deterministically and avalanches on small edits", () => {
		expect(hashContent("abc")).toBe(hashContent("abc"));
		expect(hashContent("abc")).not.toBe(hashContent("abd"));
	});

	it("strips scripts and tags to comparable text", () => {
		expect(
			toComparableText(
				"<html><head><script>var x = 1;</script></head><body><h1>Hi</h1></body></html>",
			),
		).toBe("Hi");
	});

	it("extracts #id and .class selectors", () => {
		const html = '<div id="price">$10</div><div class="ad">buy!</div>';
		expect(extractBySelector(html, "#price")).toBe("$10");
		expect(extractBySelector(html, ".ad")).toBe("buy!");
	});
});
