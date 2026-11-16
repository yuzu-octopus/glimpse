# Contribution graph mobile overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the contribution graph inside its own tile on phones and replace hover-only per-day tooltips with a tappable readout.

**Architecture:** The grid's fixed 10px cells plus `1fr` auto-minimums create ~686px of min content. Replace them with fluid `minmax()` tracks, `aspect-ratio: 1` cells and a scroll container on `.wrap`, then use an inline-size container query to raise the minimum cell size at narrow widths (fewer weeks visible at once, the rest reachable by scrolling *inside the widget*). Add one piece of local state for the selected day and render an accessible live readout; keep the existing `title` tooltips for pointer users.

**Tech Stack:** Bun 1.4.4, React 19, CSS modules + container queries, `@astryxdesign/core`, Vitest with `@testing-library/react` and `jest-dom`.

**Spec:** `/tmp/mobile-findings.md` — finding M05 and "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Existing CSS custom properties and kit tokens only; the shamrock data ramp stays, purple never encodes data.
- Every task ends with a checkable test/command; implementers do **not** run formatters or repo-wide gates — the orchestrator runs them once per wave.
- One atomic commit per completed plan; commit message names the plan file. No push.
- Wave gates (orchestrator only): `bun check`; `biome lint <each edited TS/TSX file>`; `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`.
- Per-task test command: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`.

## Review Focus

- **320px viewport with a full 53-week year:** the page must not scroll sideways; the graph scrolls only inside `.wrap`. Pinned by Task 1 step 1 (CSS source assertions for `overflow-x: auto`, `minmax(` and `aspect-ratio: 1`).
- **Touch user with no hover:** every per-day count must be reachable by tapping a cell. Pinned by Task 2 step 1 (tap readout test).
- **Keyboard/screen-reader user:** the tappable cells are real buttons with accessible names, not clickable divs with only a `title`. Pinned by Task 2 step 1 (tag/aria-label test).
- **Colour semantics:** the level ramp keeps using `--color-data-shamrock-*` and no cell takes `var(--color-primary)`. Pinned by Task 1 step 1 (negative CSS assertion).
- **Full-year integrity:** all days and month labels still render after the layout change. Pinned by Task 2 step 6 (whole test file, including the pre-existing month-label and cell-count tests, stays green).

---

### Task 1: Contain the grid width in CSS

**Files:**
- Modify: `src/client/widgets/contribution-graph/contribution-graph.module.css` (lines 1-37; leave the `.l1`–`.l4` ramp intact)
- Test: `src/client/widgets/contribution-graph/contribution-graph.test.tsx`

**Interfaces:**
- Consumes: the existing CSS-module class names `wrap`, `summary`, `grid`, `month`, `cell`, `l1`–`l4`; both the month-label row and the cell grid use `.grid` with `style={{ "--weeks": String(weeks) }}`.
- Produces: a new `.readout` class for Task 2, plus custom properties `--cell-min` and `--cell-gap` and a `@container contribution (max-width: 480px)` block.

- [ ] **Step 1: Write the failing stylesheet assertions**

Add to `src/client/widgets/contribution-graph/contribution-graph.test.tsx`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/client/widgets/contribution-graph/contribution-graph.module.css", "utf8");

describe("contribution-graph mobile layout", () => {
	it("sizes cells fluidly and contains horizontal scroll in the widget", () => {
		expect(css).toMatch(/\.wrap\s*\{[^}]*overflow-x:\s*auto/);
		expect(css).toMatch(/\.wrap\s*\{[^}]*container-type:\s*inline-size/);
		expect(css).toMatch(/\.wrap\s*\{[^}]*container-name:\s*contribution/);
		expect(css).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--weeks,\s*53\),\s*minmax\(/);
		expect(css).toMatch(/\.cell\s*\{[^}]*aspect-ratio:\s*1/);
		expect(css).toMatch(/\.cell\s*\{[^}]*width:\s*100%/);
		expect(css).not.toMatch(/\.cell\s*\{[^}]*width:\s*var\(--cell-size\)/);
		expect(css).toMatch(/@container contribution \(max-width: 480px\)/);
		expect(css).toMatch(/\.readout\s*\{/);
	});
	it("keeps the sequential shamrock ramp and never paints a cell purple", () => {
		for (const level of [1, 2, 3, 4]) {
			expect(css).toMatch(new RegExp(`\\.l${level}\\s*\\{[^}]*--color-data-shamrock-`));
		}
		expect(css).not.toMatch(/\.cell\s*\{[^}]*--color-primary/);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`
Expected: FAIL on the `overflow-x: auto` assertion (and the other new assertions).

- [ ] **Step 3: Rewrite the layout declarations in the stylesheet**

Replace the `.wrap`, `.grid` and `.cell` bodies with these declarations (keep `.summary`, `.month` and `.l1`–`.l4` unchanged) and add the readout rule:

```css
.wrap {
	--cell-size: 10px;
	--cell-min: 10px;
	--cell-gap: 3px;
	min-width: 0;
	overflow-x: auto;
	container-type: inline-size;
	container-name: contribution;
	scrollbar-width: thin;
}
.grid {
	display: grid;
	grid-template-columns: repeat(var(--weeks, 53), minmax(var(--cell-min), 1fr));
	grid-template-rows: repeat(7, minmax(var(--cell-min), 1fr));
	grid-auto-flow: column;
	gap: var(--cell-gap);
	width: 100%;
	justify-content: start;
}
.cell {
	width: 100%;
	aspect-ratio: 1;
	height: auto;
	min-width: 0;
	border-radius: 2px;
	background: var(--color-separator);
}
.readout {
	margin-top: 8px;
	font-size: 12px;
	color: var(--color-text-base-muted);
}
@container contribution (max-width: 480px) {
	.grid {
		--cell-min: 22px;
		--cell-gap: 2px;
	}
}
```

Why these values: `minmax()` removes the `1fr` auto-minimum that forced 53 × 10px + gaps into 686px; the 22px narrow-width minimum keeps cells tappable and means roughly 13 weeks are visible at 320px, with the rest reachable through the `.wrap` scroll rather than the page scroll. Both grids share `.grid`, so the month labels stay aligned with the cells.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`
Expected: PASS (all pre-existing widget tests and the new CSS assertions).

### Task 2: Tappable day readout

**Files:**
- Modify: `src/client/widgets/contribution-graph/index.tsx` (component body, lines 23-80)
- Test: `src/client/widgets/contribution-graph/contribution-graph.test.tsx`

**Interfaces:**
- Consumes: `styles.readout` from Task 1; `ContributionDay` from `src/shared/widgets/payloads.ts` (already imported); `WidgetComponentProps` unchanged.
- Produces: DOM contract only — cell buttons keep `data-testid="cell-<date>"`, `data-level`, the ramp class and `title`, and additionally carry `aria-label` and `onClick`; one `<p data-testid="contribution-readout" role="status" aria-live="polite">` inside `.wrap`. No new module exports.

- [ ] **Step 1: Write the failing component tests**

Append to the existing `describe("contribution-graph widget", ...)` block:

```tsx
it("reveals a tapped day's count in a live readout", () => {
	render(
		<ContributionGraph
			config={{ type: "contribution-graph", username: "octocat" }}
			data={{ username: "octocat", days: DAYS }}
		/>,
	);
	const readout = screen.getByTestId("contribution-readout");
	expect(readout).toHaveTextContent("Tap a day for its count");
	fireEvent.click(screen.getByTestId("cell-2024-01-02"));
	expect(readout).toHaveTextContent("3 contributions on 2024-01-02");
	fireEvent.click(screen.getByTestId("cell-2024-01-01"));
	expect(readout).toHaveTextContent("0 contributions on 2024-01-01");
});

it("makes each day a labelled button, not a hover-only div", () => {
	render(
		<ContributionGraph
			config={{ type: "contribution-graph", username: "octocat" }}
			data={{ username: "octocat", days: DAYS }}
		/>,
	);
	const cell = screen.getByTestId("cell-2024-01-02");
	expect(cell.tagName).toBe("BUTTON");
	expect(cell).toHaveAttribute("aria-label", "3 contributions on 2024-01-02");
});
```

Add `fireEvent` to the existing `@testing-library/react` import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="contribution-readout"]`.

- [ ] **Step 3: Add selection state and the readout**

In `src/client/widgets/contribution-graph/index.tsx`:

1. Import `useState` from `react`.
2. Declare `const [selected, setSelected] = useState<ContributionDay | null>(null);` unconditionally at the top of `ContributionGraph`.
3. Render each day as `<button type="button" ... onClick={() => setSelected(d)} aria-label={label}>` where `label` is the same singular/plural string as the existing `title`; keep every existing attribute and class.
4. After the cell grid, still inside `styles.wrap`, render:
   `<p className={styles.readout} data-testid="contribution-readout" role="status" aria-live="polite">{selected ? labelOf(selected) : "Tap a day for its count"}</p>`
   with `labelOf` using the same `${count} contribution${count === 1 ? "" : "s"} on ${date}` phrasing as the tooltip.
5. Leave the total-summary line and the `loading` branch unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the whole file**

Run: `bun run test src/client/widgets/contribution-graph/contribution-graph.test.tsx`
Expected: PASS — including "renders one cell per day with a tooltip", "shows total contributions", "renders month labels", loading and error tests.


