import { describe, expect, it } from "vitest";
import { ENGINE_PRESETS, listBangs, resolveEngine, resolveSearch } from "./engine";

describe("search engine", () => {
	it("resolveSearch gh query => github url", () => {
		const { url } = resolveSearch("gh query");
		expect(url).toBe("https://github.com/search?q=query");
	});

	it("routes without leading ! using first word", () => {
		const { url } = resolveSearch("yt cats");
		expect(url).toBe("https://www.youtube.com/results?search_query=cats");
	});

	it("routes with ! prefix", () => {
		const { url } = resolveSearch("!gh astryx");
		expect(url).toBe("https://github.com/search?q=astryx");
	});

	it("bare shortcut => bang url with empty query", () => {
		const { url } = resolveSearch("yt");
		expect(url).toBe("https://www.youtube.com/results?search_query=");
	});

	it("does not treat prefix as bang when not full word", () => {
		const { url } = resolveSearch("youtube results");
		expect(url).toBe("https://duckduckgo.com/?q=youtube%20results");
	});

	it("falls back to duckduckgo for empty/unknown engine", () => {
		const { url } = resolveSearch("hello", { engine: "yahoo" });
		expect(url).toBe("https://duckduckgo.com/?q=hello");
	});

	it("supports custom URL string engine", () => {
		const { url } = resolveSearch("hello world", {
			engine: "https://example.com/search?q={QUERY}",
		});
		expect(url).toBe("https://example.com/search?q=hello%20world");
	});

	it("supports object engine", () => {
		const { url } = resolveSearch("hello", {
			engine: { name: "DDG", url: "https://duckduckgo.com/?q={QUERY}" },
		});
		expect(url).toBe("https://duckduckgo.com/?q=hello");
	});

	it("preset google case-insensitive", () => {
		const { url } = resolveSearch("hello", { engine: "Google" });
		expect(url).toBe("https://www.google.com/search?q=hello");
	});

	it("returns null for empty/whitespace", () => {
		expect(resolveSearch("   ").url).toBeNull();
		expect(resolveSearch("").url).toBeNull();
	});

	it("bang takes precedence over engine", () => {
		const { url } = resolveSearch("gh hello", { engine: "https://example.com/?q={QUERY}" });
		expect(url).toBe("https://github.com/search?q=hello");
	});

	it("respects custom bangs list", () => {
		const custom = [{ title: "Foo", shortcut: "foo", url: "https://foo.com/?q={QUERY}" }];
		const { url } = resolveSearch("foo bar", { bangs: custom });
		expect(url).toBe("https://foo.com/?q=bar");
	});

	it("opens in a new tab by default, and honours newTab and an explicit target", () => {
		expect(resolveSearch("hello").target).toBe("_blank");
		expect(resolveSearch("hello", { newTab: false }).target).toBe("_self");
		expect(resolveSearch("hello", { newTab: true }).target).toBe("_blank");
		expect(resolveSearch("hello", { newTab: true, target: "_top" }).target).toBe("_top");
		// The documented precedence: an explicit `newTab: false` is a hard
		// "same tab" and outranks a configured target, while `newTab: true` with
		// no target still lands on the _blank default.
		expect(resolveSearch("hello", { newTab: false, target: "_top" }).target).toBe("_self");
		expect(resolveSearch("hello", { target: "_top" }).target).toBe("_top");
	});

	it("listBangs defaults to helium, and an empty custom list falls back to it", () => {
		// `listBangs()` returns the helium constant by identity, so comparing
		// lengths is a tautology that still passes on an empty default. Assert a
		// member instead.
		expect(listBangs().map((b) => b.shortcut)).toContain("gh");
		expect(listBangs([]).map((b) => b.shortcut)).toContain("gh");
	});

	it("listBangs returns custom when non-empty", () => {
		const custom = [{ title: "X", shortcut: "x", url: "https://x.com?q={QUERY}" }];
		expect(listBangs(custom)).toEqual(custom);
	});

	it("resolveEngine presets and custom", () => {
		expect(resolveEngine("google")).toBe(ENGINE_PRESETS.google);
		expect(resolveEngine("https://example.com/?q={QUERY}")).toBe("https://example.com/?q={QUERY}");
		expect(resolveEngine("yahoo")).toBe(ENGINE_PRESETS.duckduckgo);
		expect(resolveEngine({ name: "c", url: "https://c.com/?q={QUERY}" })).toBe(
			"https://c.com/?q={QUERY}",
		);
	});
});
