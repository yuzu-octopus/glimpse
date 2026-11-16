# Viewport / Container-Width Regression Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared source-level test file that fails if any of the six mobile-width fixes M05/M09/M11/M12/M13/M14 is reverted.

**Architecture:** A single Vitest file reads the six underlying CSS/TSX sources as text and runs named matcher functions over them. Each matcher targets a token that the corresponding fix *introduced* (e.g. `minmax(0, 1fr)` replacing `1fr`, `--space-viewport` replacing `--content-bounds-padding`, `maxLines={1}` appearing twice, `min-height: 44px` under the 600px block, `transition: none` in the reduce blocks) — never a property that was already true before the fix. A companion test feeds each matcher the exact pre-fix spelling and asserts rejection, so the suite proves it is not tautological. No component rendering, no new dependencies.

**Tech Stack:** Bun 1.4.4, Vitest 5, Node `node:fs` / `node:path`, CSS Modules source text.

**Spec:** `mobile-findings.md` (this wave's audit notes in the session temp directory), sections **M05, M09, M11, M12, M13, M14 and M16 (TEST-01)**, plus "Global constraints for every plan". The relevant verbatim requirement is: "*one shared stylesheet-invariant test file (e.g. `src/client/widgets/mobile-layout.test.ts`) that asserts the critical invariants for M05/M09/M11/M12/M13/M14 … and fails when any is reverted. Must not be tautological: assert exact strings/patterns that each fix introduced.*"

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

## Review Focus

- A matcher that also passed before the fix is a tautology: every matcher here keys on an introduced token, and the `pre-fix spellings are rejected` test rejects the old token explicitly.
- Source order and scoping can shift without changing a declaration: M13 and M14 matchers slice the relevant media block before matching, so a rule moved into the base sheet fails.
- Trailing-value truncation lives in TSX, not CSS: the M11 matcher counts exactly two `maxLines={1}` occurrences inside the `.rowRight` stack, so deleting one reintroduces the collapsed value.
- A fix can "pass" locally with a different spelling than its sibling plans expect: the matcher strings below are the wave-wide contract — conform the source, never weaken the matcher.
- This plan is the last of the wave: if a positive assertion is red on arrival, the named finding's fix is missing or reverted; do not skip it or replace it with a looser regex.

---

### Task 1: Create the shared mobile-layout invariant suite

**Files:**
- Create: `src/client/widgets/mobile-layout.test.ts`
- Test: `src/client/widgets/mobile-layout.test.ts` (the file is the test)

**Interfaces:**
- Consumes: source text of `src/client/widgets/contribution-graph/contribution-graph.module.css` (M05), `src/client/pages/page.module.css` (M09/M13/M14), `src/index.css` (M09 body guard), `src/client/widgets/custom-api/custom-api.module.css` and `src/client/widgets/custom-api/index.tsx` (M11), `src/client/widgets/events-calendar/events-calendar.module.css` (M12), `src/client/components/widget-chrome.module.css` (M14).
- Produces: no runtime exports; a test file whose named cases are `M05 contribution graph keeps fluid cells`, `M09 mobile header inset matches the page inset`, `M11 trailing values can shrink and truncate`, `M12 events use a two-track grid with no magic indent`, `M13 group tabs keep a 44px floor under 600px`, `M14 reduced-motion blocks cover every transition`, and `pre-fix spellings are rejected by every matcher`.

- [ ] **Step 1: Write the complete test file**

Create `src/client/widgets/mobile-layout.test.ts` with exactly this content:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (path: string) => readFileSync(resolve(path), "utf8");

/** One CSS rule body, or "" when the selector is absent. */
const rule = (selector: string, css: string) => {
	const start = css.indexOf(selector);
	return start < 0 ? "" : css.slice(start, css.indexOf("}", start) + 1);
};

const m05FluidGrid = (css: string) =>
	/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--weeks[^)]*\),\s*minmax\(0,\s*1fr\)\)/.test(css);
const m05FluidCell = (css: string) =>
	/\.cell\s*\{[^}]*width:\s*100%/.test(css) && /\.cell\s*\{[^}]*aspect-ratio:\s*1\b/.test(css);
const m05ScrollFloor = (css: string) => /\.wrap\s*\{[^}]*overflow-x:\s*auto/.test(css);

const m09Inset = (css: string) =>
	/\.mobileHeader\s*\{[^}]*margin:[^;]*calc\(-1 \* var\(--space-viewport\)\)/.test(css);
const m09BodyGuard = (css: string) => /body\s*\{[^}]*overflow-x:\s*clip/.test(css);

const m11RowShrink = (css: string) => {
	const right = rule(".rowRight", css);
	return /min-width:\s*0/.test(right) && !/flex-shrink:\s*0/.test(right);
};
const m11Trailing = (tsx: string) => {
	const start = tsx.indexOf("styles.rowRight");
	const block = start < 0 ? "" : tsx.slice(start, tsx.indexOf("</Stack>", start));
	return (block.match(/maxLines=\{1\}/g) ?? []).length === 2;
};

const m12Grid = (css: string) =>
	/\.event\s*\{[^}]*grid-template-columns:[^;]*minmax\(0,\s*1fr\)/.test(css);
const m12NoIndent = (css: string) => !/padding-left:\s*92px/.test(rule(".location", css));

const m13TapFloor = (css: string) => {
	const start = css.indexOf("@media (max-width: 600px)");
	const block = start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
	return /\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*min-height:\s*44px/.test(block);
};

const m14Chevron = (css: string) => {
	const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
	return start >= 0 && /\.chevron\s*\{[^}]*transition:\s*none/.test(css.slice(start));
};
const m14Page = (css: string) => {
	const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
	const block = start < 0 ? "" : css.slice(start);
	return /\.groupTabsIndicator\s*\{[^}]*transition:\s*none/.test(block)
		&& /\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*transition:\s*none/.test(block)
		&& /\.mobileToggle\s*\{[^}]*transition:\s*none/.test(block);
};

/** The exact pre-fix spellings, so each matcher is proven selective. */
const REVERTED = {
	m05: ".grid { grid-template-columns: repeat(var(--weeks, 53), 1fr); } .cell { width: var(--cell-size); height: var(--cell-size); } .wrap { min-width: 0; }",
	m09: ".mobileHeader { margin: calc(-1 * var(--widget-gap)) calc(-1 * var(--content-bounds-padding)); }",
	body: "body { overflow-y: scroll; }",
	m11: ".rowRight { flex-shrink: 0; }",
	m11tsx: '<Stack hAlign="end" className={styles.rowRight}><Text>{item.value}</Text><Text>{item.timestamp}</Text></Stack>',
	m12: ".event { display: flex; } .location { padding-left: 92px; }",
	m13: "@media (max-width: 600px) { .mobileToggle { display: inline-flex; } }",
	m14chrome: "@media (prefers-reduced-motion: reduce) { .bodyReveal { animation: none; } }",
	m14page: "@media (prefers-reduced-motion: reduce) { .groupTabsIndicator { transition: none; } }",
};

describe("mobile viewport invariants", () => {
	it("M05 contribution graph keeps fluid cells", () => {
		const css = src("src/client/widgets/contribution-graph/contribution-graph.module.css");
		expect(m05FluidGrid(css)).toBe(true);
		expect(m05FluidCell(css)).toBe(true);
		expect(m05ScrollFloor(css)).toBe(true);
	});

	it("M09 mobile header inset matches the page inset", () => {
		const page = src("src/client/pages/page.module.css");
		expect(m09Inset(page)).toBe(true);
		expect(m09BodyGuard(src("src/index.css"))).toBe(true);
	});

	it("M11 trailing values can shrink and truncate", () => {
		const css = src("src/client/widgets/custom-api/custom-api.module.css");
		expect(m11RowShrink(css)).toBe(true);
		expect(m11Trailing(src("src/client/widgets/custom-api/index.tsx"))).toBe(true);
	});

	it("M12 events use a two-track grid with no magic indent", () => {
		const css = src("src/client/widgets/events-calendar/events-calendar.module.css");
		expect(m12Grid(css)).toBe(true);
		expect(m12NoIndent(css)).toBe(true);
	});

	it("M13 group tabs keep a 44px floor under 600px", () => {
		expect(m13TapFloor(src("src/client/pages/page.module.css"))).toBe(true);
	});

	it("M14 reduced-motion blocks cover every transition", () => {
		expect(m14Chevron(src("src/client/components/widget-chrome.module.css"))).toBe(true);
		expect(m14Page(src("src/client/pages/page.module.css"))).toBe(true);
	});

	it("pre-fix spellings are rejected by every matcher", () => {
		expect(m05FluidGrid(REVERTED.m05)).toBe(false);
		expect(m05FluidCell(REVERTED.m05)).toBe(false);
		expect(m05ScrollFloor(REVERTED.m05)).toBe(false);
		expect(m09Inset(REVERTED.m09)).toBe(false);
		expect(m09BodyGuard(REVERTED.body)).toBe(false);
		expect(m11RowShrink(REVERTED.m11)).toBe(false);
		expect(m11Trailing(REVERTED.m11tsx)).toBe(false);
		expect(m12Grid(REVERTED.m12)).toBe(false);
		expect(m12NoIndent(REVERTED.m12)).toBe(false);
		expect(m13TapFloor(REVERTED.m13)).toBe(false);
		expect(m14Chevron(REVERTED.m14chrome)).toBe(false);
		expect(m14Page(REVERTED.m14page)).toBe(false);
	});
});
```

- [ ] **Step 2: Run the suite**

Run: `bun run test src/client/widgets/mobile-layout.test.ts`
Expected: PASS when M05/M09/M11/M12/M13/M14 are applied. A red `M<nn>` case means that finding's fix is missing or spelled differently — conform the source to the matcher; do not loosen the matcher.

- [ ] **Step 3: Prove the suite is not tautological**

Run: `bun run test src/client/widgets/mobile-layout.test.ts -t "pre-fix spellings are rejected by every matcher"`
Expected: PASS — all twelve matcher/fixture pairs reject the pre-fix spelling. This is the guard against a matcher that would still pass after a revert.

- [ ] **Step 4: Verify the file is picked up by the normal suite and typechecks**

Run: `bun run test src/client/widgets/mobile-layout.test.ts && bun check`
Expected: PASS for both; no inline cast, no `ReturnType` alias, no new dependency.


