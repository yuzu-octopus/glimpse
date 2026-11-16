# Mobile Touch Targets (Group Tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give widget-group tabs a 44px tap target at viewport ≤600px and keep the sliding underline aligned when the tab strip reflows.

**Architecture:** Add one declaration to the existing `@media (max-width: 600px)` block in the page stylesheet under the already-present `.groupTabs button, .groupTabs [data-tab-value]` selector — no new selector layer. Extend the existing `useLayoutEffect` in `GroupTabs` with a `ResizeObserver` on the strip, so the measured underline follows strip reflow that does not fire a window resize. Source-level Vitest assertions pin the exact CSS spelling and the observer wiring; the existing tab behaviour tests stay as the behavioural gate.

**Tech Stack:** Bun 1.4.4, React 19, Vitest 5 + @testing-library/react, Astryx `TabList`/`Tab`, CSS Modules.

**Spec:** `mobile-findings.md` (this wave's audit notes in the session temp directory), sections **M13 (UX-05)** and **M16**, plus "Global constraints for every plan". The relevant verbatim requirement is: "*groupTabs button padding 0, line-height ~1.6em, kit minHeight 32px; other controls 44px. Fix: `@media (max-width:600px)` min-height:44px on tab buttons and re-measure the sliding underline. Test: CSS assertion + existing GroupTabs test still green.*"

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

## Review Focus

- Unequal tab-label widths: the underline must keep matching the active tab's real rect, not an index × width guess — Task 2's test forces the measured `getBoundingClientRect` path with deliberately unequal labels and checks the observer is attached to the strip.
- Desktop viewport >600px must keep the kit's 32px tab box; a 44px rule leaking out of the media query inflates every strip — Task 1 asserts the declaration is absent from the pre-media portion of the stylesheet.
- Astryx may render a tab as `[data-tab-value]` rather than a literal `<button>`; a button-only rule leaves those tabs short — Task 1 asserts both selectors in the rule.
- Source order matters: app CSS is unlayered and imported last, so the mobile rule only wins at equal specificity if it comes after the base rule — Task 1 asserts the media block's offset is greater than the base rule's.
- Horizontal scroll of the tab strip must not detach the underline — Task 2's test asserts the existing `scroll` listener is still registered after the observer is added.

---

### Task 1: 44px tap floor for group tabs at ≤600px

**Files:**
- Modify: `src/client/pages/page.module.css:394-446` (add a rule inside the existing `@media (max-width: 600px)` block, after `.mobileToggle`)
- Test: `src/client/pages/PageView.test.tsx` (new `it` beside the existing group-tab tests around line 294)

**Interfaces:**
- Consumes: none — CSS source only.
- Produces: the exact CSS contract M16 asserts — inside `@media (max-width: 600px)`, the rule `.groupTabs button, .groupTabs [data-tab-value] { min-height: 44px; }`.

- [ ] **Step 1: Write the failing CSS assertion**

Add to the main `describe` in `src/client/pages/PageView.test.tsx`:

```ts
	it("group tabs keep a 44px tap target at 600px and below", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		const mobileStart = css.indexOf("@media (max-width: 600px)");
		expect(mobileStart).toBeGreaterThan(-1);
		const mobile = css.slice(mobileStart, css.indexOf("\n}", mobileStart));
		expect(mobile).toMatch(
			/\.groupTabs\s+button,\s*\.groupTabs\s+\[data-tab-value\]\s*\{[^}]*min-height:\s*44px/,
		);
		// the floor is mobile-only and it sits after the base rule
		expect(css.slice(0, mobileStart)).not.toMatch(/\.groupTabs\s+button[\s\S]*?min-height:\s*44px/);
		expect(mobileStart).toBeGreaterThan(css.indexOf(".groupTabs button,"));
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/pages/PageView.test.tsx -t "group tabs keep a 44px tap target"`
Expected: FAIL on the `min-height: 44px` `toMatch` assertion.

- [ ] **Step 3: Add the mobile rule**

In `src/client/pages/page.module.css`, inside the existing `@media (max-width: 600px)` block, immediately after the `.mobileToggle { display: inline-flex; }` rule, add exactly:

```css
	.groupTabs button,
	.groupTabs [data-tab-value] {
		min-height: 44px;
	}
```

Leave the base rule at lines 282-300 untouched; later same-specificity source order is what scopes the floor to mobile without `!important`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx -t "group tabs keep a 44px tap target"`
Expected: PASS.

- [ ] **Step 5: Run the full PageView suite (existing GroupTabs tests stay green)**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: PASS, including `renders group children as tabs` and `keeps the panel on a tab that still exists when the group shrinks`.



### Task 2: Keep the sliding underline measured after tab-box reflow

**Files:**
- Modify: `src/client/pages/PageView.tsx:485-508` (`GroupTabs` `useLayoutEffect`)
- Test: `src/client/pages/PageView.test.tsx` (new `it` after the Task 1 test; `vi` is already imported there)

**Interfaces:**
- Consumes: `GroupTabs` as defined in `src/client/pages/PageView.tsx:473-528`; `TabList` carries `aria-label="Group tabs"` (line 515), which the test uses to find the strip.
- Produces: no new exported API. The effect now calls `measure` from a `ResizeObserver` on the strip, disconnects it in cleanup, and still registers the `scroll` and `resize` listeners.

- [ ] **Step 1: Write the failing observer test**

Add to `src/client/pages/PageView.test.tsx`:

```ts
	it("re-measures the group-tab underline when the strip resizes", async () => {
		const observed: Element[] = [];
		class StubResizeObserver {
			observe(target: Element) {
				observed.push(target);
			}
			unobserve() {}
			disconnect() {}
		}
		vi.stubGlobal("ResizeObserver", StubResizeObserver);
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "group",
								config: { type: "group" },
								data: null,
								widgets: [
									{ type: "clock", config: { type: "clock", title: "Wide tab label" }, data: null },
									{ type: "clock", config: { type: "clock", title: "B" }, data: null },
								],
							},
						],
					},
				],
			}),
		);
		await screen.findByRole("button", { name: "Wide tab label" });
		expect(observed).toContain(document.querySelector('[aria-label="Group tabs"]'));
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/pages/PageView.test.tsx -t "re-measures the group-tab underline"`
Expected: FAIL — `observed` is empty because `ResizeObserver` is never constructed.

- [ ] **Step 3: Observe the strip in the existing effect**

In `GroupTabs`' `useLayoutEffect` in `src/client/pages/PageView.tsx`, after the existing `if (!strip) return;` guard, construct `const observer = new ResizeObserver(measure);` and call `observer.observe(strip);` before the `scroll`/`resize` listener registration. In the returned cleanup, call `observer.disconnect();` alongside the two existing `removeEventListener` calls. Keep the `measure` body and its `getBoundingClientRect` calculation exactly as they are.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx -t "re-measures the group-tab underline"`
Expected: PASS.

- [ ] **Step 5: Run the full PageView suite and the typecheck**

Run: `bun run test src/client/pages/PageView.test.tsx && bun check`
Expected: PASS for both — the resize/scroll paths are unchanged, and no cast or type alias was introduced.


