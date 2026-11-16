import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (path: string) => readFileSync(resolve(path), "utf8");

/** One CSS rule body, or "" when the selector is absent. */
const rule = (selector: string, css: string) => {
	const start = css.indexOf(selector);
	return start < 0 ? "" : css.slice(start, css.indexOf("}", start) + 1);
};

// M05 pins minmax(0, 1fr) — a --cell-min floor recreates the 686px
// min-content that made the whole page scroll sideways.
const m05FluidGrid = (css: string) =>
	/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--weeks[^)]*\),\s*minmax\(0,\s*1fr\)\)/.test(
		css,
	);
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
	return /\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*min-height:\s*44px/.test(
		block,
	);
};

const m14Chevron = (css: string) => {
	const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
	return start >= 0 && /\.chevron\s*\{[^}]*transition:\s*none/.test(css.slice(start));
};
const m14Page = (css: string) => {
	const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
	const block = start < 0 ? "" : css.slice(start);
	return (
		/\.groupTabsIndicator\s*\{[^}]*transition:\s*none/.test(block) &&
		/\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*transition:\s*none/.test(
			block,
		) &&
		/\.mobileToggle\s*\{[^}]*transition:\s*none/.test(block)
	);
};

/** The exact pre-fix spellings, so each matcher is proven selective. */
const REVERTED = {
	m05: ".grid { grid-template-columns: repeat(var(--weeks, 53), 1fr); } .cell { width: var(--cell-size); height: var(--cell-size); } .wrap { min-width: 0; }",
	m09: ".mobileHeader { margin: calc(-1 * var(--widget-gap)) calc(-1 * var(--content-bounds-padding)); }",
	body: "body { overflow-y: scroll; }",
	m11: ".rowRight { flex-shrink: 0; }",
	m11tsx:
		'<Stack hAlign="end" className={styles.rowRight}><Text>{item.value}</Text><Text>{item.timestamp}</Text></Stack>',
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
