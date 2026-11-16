# Reduced-Motion Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every transition on the widget chevron, the group tabs, and the mobile column toggle snap off under `prefers-reduced-motion: reduce`.

**Architecture:** Extend the two existing `@media (prefers-reduced-motion: reduce)` blocks — one in the shared widget chrome stylesheet, one in the page stylesheet — with explicit `transition: none` rules for the surfaces their current blocks miss. No new media query, no JS, no change to the existing animation-disabling rules. Source-level Vitest assertions pin the exact rule text; M16 reuses that spelling as a regression contract.

**Tech Stack:** Bun 1.4.4, React 19, Vitest 5, CSS Modules, Astryx kit CSS tokens (`--duration-fast`, `--ease-standard`).

**Spec:** `mobile-findings.md` (this wave's audit notes in the session temp directory), sections **M14 (A11Y-06)** and **M16**, plus "Global constraints for every plan". The relevant verbatim requirement is: "*widget-chrome.module.css:145-151 `.chevron` transition; reduce block :102-106 only bodyReveal. page.module.css:297-299 tabs + :195 toggle transitions; reduce block :258-262 only indicator. Fix: extend both reduce blocks. Test: CSS source assertions.*"

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

## Review Focus

- Chevron rotation on expand/collapse is the action answer for a disclosure; under reduce it must snap to the new angle, not animate — Task 1 asserts `.chevron { transition: none }` inside the reduce block.
- The existing `bodyReveal` animation opt-out must survive the edit; a rewrite of the reduce block that drops it reintroduces entrance motion — Task 1 asserts both declarations in the same block.
- Tab colour and border transitions on press/hover must snap under reduce; they are declared on the same compound selector M13 uses for its 44px floor — Task 2 asserts that selector's `transition: none` inside the reduce block.
- The mobile column toggle's background wash (hover/press) must snap too; it is the only way into a collapsed column on a phone — Task 2 asserts `.mobileToggle { transition: none }`.
- The already-correct indicator slide opt-out must remain; "extend" means add rules, not replace the block — Task 2 asserts all three rules coexist in one reduce block.

---

### Task 1: Silence the widget-chrome chevron under reduce

**Files:**
- Modify: `src/client/components/widget-chrome.module.css:102-106` (the existing `@media (prefers-reduced-motion: reduce)` block)
- Test: `src/client/components/WidgetChrome.test.tsx` (new `it` in `describe("WidgetChrome brand principles", …)`, which already imports `readFileSync`)

**Interfaces:**
- Consumes: none — CSS source only.
- Produces: exact CSS contract M16 asserts — inside the widget-chrome reduce block, `.chevron { transition: none; }` coexists with `.bodyReveal { animation: none; }`.

- [ ] **Step 1: Write the failing CSS assertion**

Add to `describe("WidgetChrome brand principles", …)` in `src/client/components/WidgetChrome.test.tsx`:

```ts
	it("reduced motion snaps the chevron and keeps the body-reveal opt-out", () => {
		const css = readFileSync("src/client/components/widget-chrome.module.css", "utf8");
		const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
		expect(reduce).toMatch(/\.chevron\s*\{[^}]*transition:\s*none/);
		expect(reduce).toMatch(/\.bodyReveal\s*\{[^}]*animation:\s*none/);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/components/WidgetChrome.test.tsx -t "reduced motion snaps the chevron"`
Expected: FAIL on the `.chevron` `toMatch` assertion; the `bodyReveal` half already passes.

- [ ] **Step 3: Extend the reduce block**

In `src/client/components/widget-chrome.module.css`, inside the existing `@media (prefers-reduced-motion: reduce)` block at lines 102-106, add after the `.bodyReveal` rule:

```css
	.chevron {
		transition: none;
	}
```

Do not edit the `.chevron` base rule at lines 145-151 — the transform still answers expansion; only its transition is disabled.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun run test src/client/components/WidgetChrome.test.tsx -t "reduced motion snaps the chevron"`
Expected: PASS.

- [ ] **Step 5: Run the full WidgetChrome suite**

Run: `bun run test src/client/components/WidgetChrome.test.tsx`
Expected: PASS, including the existing `carries no shadow-based depth — borders only` and skeleton-shape tests.



### Task 2: Silence tab and column-toggle transitions under reduce

**Files:**
- Modify: `src/client/pages/page.module.css:258-262` (the existing `@media (prefers-reduced-motion: reduce)` block)
- Test: `src/client/pages/PageView.test.tsx` (new `it` near the other CSS-source assertions around line 945; `readFileSync` already imported)

**Interfaces:**
- Consumes: the M13 mobile tap-floor rule `.groupTabs button, .groupTabs [data-tab-value]` (separate declaration, same selector — no conflict).
- Produces: exact CSS contract M16 asserts — inside the page reduce block, rules for `.groupTabsIndicator`, the compound `.groupTabs button, .groupTabs [data-tab-value]`, and `.mobileToggle`, each with `transition: none`.

- [ ] **Step 1: Write the failing CSS assertion**

Add to `src/client/pages/PageView.test.tsx`:

```ts
	it("reduced motion snaps tabs, the indicator and the column toggle", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
		expect(reduce).toMatch(/\.groupTabsIndicator\s*\{[^}]*transition:\s*none/);
		expect(reduce).toMatch(
			/\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*transition:\s*none/,
		);
		expect(reduce).toMatch(/\.mobileToggle\s*\{[^}]*transition:\s*none/);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/pages/PageView.test.tsx -t "reduced motion snaps tabs"`
Expected: FAIL on the compound tab-selector assertion; the indicator half already passes.

- [ ] **Step 3: Extend the page reduce block**

In `src/client/pages/page.module.css`, replace the existing reduce block at lines 258-262 with:

```css
@media (prefers-reduced-motion: reduce) {
	.groupTabsIndicator {
		transition: none;
	}
	.groupTabs button,
	.groupTabs [data-tab-value] {
		transition: none;
	}
	.mobileToggle {
		transition: none;
	}
}
```

Leave the base transitions at lines 195 and 297-299 untouched; the reduce block is later in the sheet, so it wins at equal specificity.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx -t "reduced motion snaps tabs"`
Expected: PASS.

- [ ] **Step 5: Run the full PageView suite and typecheck**

Run: `bun run test src/client/pages/PageView.test.tsx && bun check`
Expected: PASS for both.


