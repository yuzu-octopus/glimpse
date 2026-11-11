/**
 * Toolchain + TTL derivation contract: docs must quote the code, not copy it.
 *
 * Two invariants, both of which drifted silently before this file existed:
 *  1. AGENTS.md + README.md pin the same astryx-dracula range package.json
 *     installs (both the `^x.y.z` form and the `pkg@x.y.z` form in AGENTS).
 *     Every future dep bump must update the doc line in the same commit.
 *  2. The vite TTL table quotes every TTL_OVERRIDE_MS per-type exception
 *     shared/live.ts declares, with the same numbers. Every future TTL change
 *     must update the table row in the same commit.
 *
 * Table home: TTL_OVERRIDE_MS in src/shared/live.ts (moved there by the
 * TTL consolidation); the "TTL tiers" comment in the vite.config.ts
 * workbox block quotes it. One place, not two.
 *
 * Deliberately not covered: the dead toolchain commands (`bunx tsc
 * --noEmit`, `biome check src scripts`) are asserted by convention, not
 * here; extend this file if command drift recurs.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

// Sources of truth, read at test time (same style as theme-tokens.test.ts).
const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
const agents = read("AGENTS.md");
const readme = read("README.md");
const vite = read("vite.config.ts");
const TTL_SOURCE = read("src/shared/live.ts");

/** Declared TTL for one TTL_OVERRIDE_MS entry, parsed from code. */
const ttlMsFor = (type: string): number => {
	const m = new RegExp(`"${type}": ([\\d_]+)`).exec(TTL_SOURCE);
	if (!m)
		throw new Error(`TTL_OVERRIDE_MS has no "${type}" entry (table moved — update TTL_SOURCE)`);
	return Number(m[1].replace(/_/g, ""));
};

describe("toolchain contract", () => {
	const kitRange = pkg.dependencies["astryx-dracula"];

	it("pins the same astryx-dracula range in docs as package.json", () => {
		expect(kitRange).toMatch(/^\^\d+\.\d+\.\d+$/);
		expect(agents).toContain(`\`${kitRange}\``);
		expect(readme).toContain(`\`${kitRange}\``);
		expect(agents).toContain(`astryx-dracula@${kitRange.replace(/^\^/, "")}`);
	});

	it("quotes every getDefaultTtl per-type exception in the vite TTL table", () => {
		const lines = vite.split("\n");
		for (const type of ["weather-radar", "model-releases"]) {
			const label = `${ttlMsFor(type) / 1000}s`;
			const quoted = lines.some((line) => line.includes(type) && line.includes(label));
			expect(quoted, `${type} ${label} missing from the vite TTL table`).toBe(true);
		}
	});
});
