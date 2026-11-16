# Settings Nav Rail Clip at 320px Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all three settings-section labels reachable when the dialog is opened at a 320px viewport instead of letting the row-mode nav rail clip them.

**Architecture:** In the existing `@media (max-width: 720px)` block, let `.nav` wrap its row and pin its children to their content width with `flex: 0 0 auto`. Wrapping is chosen over an `overflow-x` scroller because the three labels are primary navigation: hidden items must not require a horizontal gesture inside a modal. Source-level CSS assertions plus the existing "three nav buttons" component render pin both halves.

**Tech Stack:** Bun 1.4.4, React 19, Vitest 5 + @testing-library/react, Astryx `Dialog` / `SideNavItem`, CSS Modules.

**Spec:** `mobile-findings.md` (this wave's audit notes in the session temp directory), section **M15 (CORRECTNESS-05)** plus "Global constraints for every plan". The relevant verbatim requirement is: "*settings-panel.module.css:246-256 row flip with no wrap/overflow; dialog width `min(960px, 100vw-32px)` (SettingsPanel.tsx:145); three labelled items. Fix: flex-wrap:wrap or bounded overflow-x with flex:0 0 auto. Test: CSS assertion + component test rendering all three items.*"

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

## Review Focus

- At 320px the dialog is `min(960px, calc(100vw - 32px))` = 288px wide; the three labelled items must wrap rather than be cut off — Task 1 renders all three and asserts the wrap rule.
- A long or translated section label must not be squeezed to an unreadable stub by flex shrink — Task 1 asserts `flex: 0 0 auto` on `.nav > *`.
- The selected item's kit treatment must survive the orientation flip (the old left-border rule needed re-deriving) — Task 1 re-runs the existing `opens on About and lists About, Docs and Changelog` test, which checks `aria-current`.
- Keyboard reach must remain complete after wrapping — Task 1 re-runs the existing `keeps every section reachable by keyboard` test (three enabled `<button>`s).
- Wrapping must not be achieved with a clipping container that hides the overflowing item — Task 1 asserts the narrow `.nav` rule does not add `overflow: hidden`.

---

### Task 1: Wrap the narrow settings nav rail

**Files:**
- Modify: `src/client/components/settings-panel.module.css:246-256` (the `.nav` rule inside `@media (max-width: 720px)`)
- Test: `src/client/components/SettingsPanel.test.tsx` (new `it` in `describe("SettingsPanel section sidebar", …)`; `readFileSync`, `stylesheet`, `stubConfigApi`, `render`, `fireEvent`, `screen`, `within` are already in scope)

**Interfaces:**
- Consumes: the `SettingsPanel` `data-testid="settings-nav"` node and its three `SideNavItem` labels (`About`, `Docs`, `Changelog`) from `src/client/components/SettingsPanel.tsx:151-170`.
- Produces: no new exported API. CSS contract: inside `@media (max-width: 720px)`, `.nav` keeps `flex-direction: row` and gains `flex-wrap: wrap`; a `.nav > *` rule sets `flex: 0 0 auto`.

- [ ] **Step 1: Write the failing test**

Add to `describe("SettingsPanel section sidebar", …)` in `src/client/components/SettingsPanel.test.tsx`:

```ts
	it("wraps the nav rail instead of clipping its three labels at 320px", () => {
		stubConfigApi();
		render(<SettingsPanel />);
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));

		const nav = screen.getByTestId("settings-nav");
		for (const label of ["About", "Docs", "Changelog"]) {
			expect(within(nav).getByText(label).closest("button")).not.toBeNull();
		}

		const dialog = readFileSync("src/client/components/SettingsPanel.tsx", "utf8");
		expect(dialog).toMatch(/width="min\(960px,\s*calc\(100vw - 32px\)\)"/);

		const narrowStart = stylesheet.indexOf("@media (max-width: 720px)");
		expect(narrowStart).toBeGreaterThan(-1);
		const narrow = stylesheet.slice(narrowStart);
		expect(narrow).toMatch(/\.nav\s*\{[^}]*flex-direction:\s*row[^}]*flex-wrap:\s*wrap/);
		expect(narrow).toMatch(/\.nav\s*>\s*\*\s*\{[^}]*flex:\s*0\s+0\s+auto/);
		expect(narrow).not.toMatch(/\.nav\s*\{[^}]*overflow:\s*hidden/);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/components/SettingsPanel.test.tsx -t "wraps the nav rail"`
Expected: FAIL on the `flex-wrap: wrap` assertion; the component half and the dialog-width assertion already pass.

- [ ] **Step 3: Let the narrow nav wrap**

In `src/client/components/settings-panel.module.css`, inside the existing `@media (max-width: 720px)` block, change the `.nav` rule to add `flex-wrap: wrap;` after `flex-direction: row;`, then add a sibling rule immediately after it:

```css
	.nav > * {
		flex: 0 0 auto;
	}
```

Keep `width: auto`, `border-right: none`, and the bottom border exactly as they are — only the wrap behaviour changes.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun run test src/client/components/SettingsPanel.test.tsx -t "wraps the nav rail"`
Expected: PASS.

- [ ] **Step 5: Run the full SettingsPanel suite and typecheck**

Run: `bun run test src/client/components/SettingsPanel.test.tsx && bun check`
Expected: PASS, including `opens on About and lists About, Docs and Changelog` (`aria-current` survives the orientation flip) and `keeps every section reachable by keyboard — no href-less anchors`.


