/**
 * Token contract for the astryx-dracula import.
 *
 * Two invariants, both of which the retired ":root dracula hex block" era
 * broke silently:
 *  1. Every var() our stylesheets read resolves. Sources: a declaration in app
 *     CSS, a custom property set by a component, Astryx core's :root, or the
 *     kit (tokens.css paints :root, theme.css paints the @scope'd
 *     [data-astryx-theme] that <Theme> puts on <html>).
 *  2. No app stylesheet declares a --color-* literal. Brand colour lives in
 *     the kit (../astryx-dracula/astryx-theme.ts); app CSS is unlayered and
 *     imported last, so a single hex here silently outranks the whole theme.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const KIT = "node_modules/astryx-dracula";
const CORE = "node_modules/@astryxdesign/core/dist";

const read = (path: string): string => readFileSync(path, "utf8");

const walk = (dir: string, exts: string[]): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return walk(path, exts);
		return exts.some((ext) => entry.name.endsWith(ext)) ? [path] : [];
	});

const cssFiles = walk("src", [".css"]);
// Test files quote the same tokens in assertions; scanning them would make the
// contract depend on its own documentation.
const codeFiles = walk("src", [".ts", ".tsx"]).filter((f) => !f.includes(".test."));
const appCss = cssFiles.map(read);
const appCode = codeFiles.map(read);

/** Custom properties a source declares, CSS rule or inline style key alike. */
const declares = (source: string): string[] =>
	[...source.matchAll(/['"]?(--[a-zA-Z0-9-]+)['"]?\s*:/g)].map((m) => m[1]);

/** Custom properties a source reads through var(), flagged when it has a fallback. */
const reads = (source: string): Array<{ name: string; fallback: boolean }> =>
	[...source.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)].map((m) => ({
		name: m[1],
		fallback: m[2] === ",",
	}));

/** Custom properties declared on :root rather than on a class. */
const rootDeclares = (source: string): string[] =>
	source
		.split("\n")
		.filter((line) => /^\s*:root[\s,{]/.test(line))
		.flatMap(declares);

describe("theme token contract", () => {
	const supplied = new Set([
		...appCss.flatMap(declares),
		...appCode.flatMap(declares),
		...rootDeclares(read(`${CORE}/astryx.css`)),
		...declares(read(`${KIT}/tokens.css`)),
		...declares(read(`${KIT}/theme.css`)),
	]);

	it("supplies every custom property our stylesheets read", () => {
		const unresolved = new Set<string>();
		for (const { name, fallback } of [...appCss, ...appCode].flatMap(reads)) {
			if (!fallback && !supplied.has(name)) unresolved.add(name);
		}
		expect([...unresolved].sort()).toEqual([]);
	});

	it("keeps brand colour literals out of app stylesheets", () => {
		const literals: string[] = [];
		for (const [i, source] of appCss.entries()) {
			for (const line of source.split("\n")) {
				const m = /^\s*(--color-[a-zA-Z0-9-]+)\s*:\s*(.+?);\s*$/.exec(line);
				// An alias (the value goes through var()) is fine; a raw value is not.
				if (m && !m[2].includes("var(")) literals.push(`${cssFiles[i]}: ${line.trim()}`);
			}
		}
		expect(literals).toEqual([]);
	});
});
