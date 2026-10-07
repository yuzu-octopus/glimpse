/**
 * `--color-text-subdue` is a chrome-only token.
 *
 * The astryx-dracula kit documents it as "metadata and separators" — a
 * hairline/mark colour, not a foreground. In dark mode it resolves to
 * #4C5067, which is 1.80:1 against the page background and 1.49:1 against the
 * widget surface, so any text painted with it is effectively invisible. The
 * muted foreground step for this brand is `--color-text-base-muted`.
 *
 * This guard fails if subdue ever comes back as a foreground value, whether
 * declared in CSS, in a style object, or as an SVG paint attribute. Borders,
 * hairlines, gridlines and status fills are the token's actual job and stay.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = "src/client";

const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return walk(path);
		return [path];
	});

// Test files quote tokens in their own assertions; scanning them would make
// the contract depend on its own documentation.
const sources = walk(CLIENT)
	.filter((f) => !f.includes(".test."))
	.filter((f) => f.endsWith(".module.css") || /\.tsx?$/.test(f))
	.map((f) => ({ path: f, text: readFileSync(f, "utf8") }));

/** `border-color` is chrome; a bare `color` is a foreground. */
const FOREGROUND_CSS = /(^|[\s;{])color\s*:\s*([^;{}]*)/g;
const FOREGROUND_JSX = /\b(color|stroke|fill)\s*[:=]\s*['"`]?([^'"`;}]*)/g;

const offenders: string[] = [];

for (const { path, text } of sources) {
	const rules: Array<[RegExp, string]> = path.endsWith(".css")
		? [[FOREGROUND_CSS, "color"]]
		: [[FOREGROUND_JSX, "color|stroke|fill"]];

	for (const [pattern, label] of rules) {
		for (const match of text.matchAll(pattern)) {
			if (!match[2].includes("var(--color-text-subdue)")) continue;
			const line = text.slice(0, match.index).split("\n").length;
			offenders.push(`${path}:${line} — ${label}: ${match[0].trim()}`);
		}
	}
}

describe("subdue text token contract", () => {
	it("never paints text or icons with --color-text-subdue", () => {
		expect(offenders).toEqual([]);
	});

	it("keeps subdue out of the muted foreground step", () => {
		// The swap is one-directional: muted body copy must not alias back to a
		// chrome colour, which would reintroduce the 1.80:1 failure silently.
		const aliased = sources
			.filter(({ text }) => /--color-text-base-muted\s*:\s*[^;{}]*--color-text-subdue/.test(text))
			.map(({ path }) => path);
		expect(aliased).toEqual([]);
	});
});
