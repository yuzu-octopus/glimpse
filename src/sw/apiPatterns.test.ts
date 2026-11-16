import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apiConfigPattern, apiPagePattern, apiThemePattern } from "./apiPatterns";

const at = (path: string): { url: URL } => ({ url: new URL(path, "https://glimpse.local") });

describe("apiPatterns", () => {
	it("matches absolute config, theme and page URLs", () => {
		expect(apiConfigPattern(at("/api/config"))).toBe(true);
		expect(apiThemePattern(at("/api/theme"))).toBe(true);
		expect(apiPagePattern(at("/api/page/home"))).toBe(true);
		expect(apiConfigPattern(at("https://other.example/api/config?foo=1"))).toBe(true);
	});

	it("keeps query strings on non-stream endpoints cacheable", () => {
		expect(apiConfigPattern(at("/api/config?v=1"))).toBe(true);
		expect(apiThemePattern(at("/api/theme?v=1"))).toBe(true);
		expect(apiPagePattern(at("/api/page/home?v=1"))).toBe(true);
	});

	it("does not cache streamed page responses", () => {
		expect(apiPagePattern(at("/api/page/home?stream"))).toBe(false);
		expect(apiPagePattern(at("/api/page/home?stream=true"))).toBe(false);
		expect(apiPagePattern(at("/api/page/home?stream=1&v=2"))).toBe(false);
	});

	it("rejects near-miss paths", () => {
		expect(apiConfigPattern(at("/api/configuration"))).toBe(false);
		expect(apiThemePattern(at("/api/theme-editor"))).toBe(false);
		expect(apiPagePattern(at("/api/page"))).toBe(false);
		expect(apiPagePattern(at("/assets/page/home"))).toBe(false);
	});

	it("wires the predicates into every SW API route", () => {
		const config = readFileSync("vite.config.ts", "utf8");
		expect(config).toContain("urlPattern: apiConfigPattern");
		expect(config).toContain("urlPattern: apiPagePattern");
		expect(config).toContain("urlPattern: apiThemePattern");
		expect(config).not.toContain("/^\\/api\\/config");
		expect(config).not.toContain("/^\\/api\\/page\\//");
		expect(config).not.toContain("/^\\/api\\/theme");
	});
});
