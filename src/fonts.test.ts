import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(p, "utf8");

describe("font delivery", () => {
	it("overrides both JetBrains Mono weights with served local files", () => {
		const css = read("src/index.css");
		expect(css).toMatch(
			/@font-face\s*\{[^}]*font-family:\s*"JetBrains Mono";[^}]*font-weight:\s*400;[^}]*src:\s*url\("\/fonts\/JetBrainsMono-Regular\.woff2"\)/,
		);
		expect(css).toMatch(
			/@font-face\s*\{[^}]*font-family:\s*"JetBrains Mono";[^}]*font-weight:\s*600;[^}]*src:\s*url\("\/fonts\/JetBrainsMono-SemiBold\.woff2"\)/,
		);
		expect(css).not.toContain("/astryx-dracula/fonts/");
	});

	it("loads the font overrides after the kit tokens", () => {
		const main = read("src/main.tsx");
		expect(main.indexOf('import "astryx-dracula/tokens.css"')).toBeLessThan(
			main.indexOf('import "./index.css"'),
		);
		expect(main.indexOf('import "astryx-dracula/theme.css"')).toBeLessThan(
			main.indexOf('import "./index.css"'),
		);
	});

	it("preloads the served font files", () => {
		const html = read("index.html");
		expect(html).toContain('href="/fonts/JetBrainsMono-Regular.woff2"');
		expect(html).toContain('href="/fonts/JetBrainsMono-SemiBold.woff2"');
		expect(html).not.toContain("/astryx-dracula/fonts/");
	});

	it("precache glob includes woff2 and both public font files exist", () => {
		const config = read("vite.config.ts");
		expect(config).toContain("woff2");
		expect(existsSync("public/fonts/JetBrainsMono-Regular.woff2")).toBe(true);
		expect(existsSync("public/fonts/JetBrainsMono-SemiBold.woff2")).toBe(true);
	});
});
