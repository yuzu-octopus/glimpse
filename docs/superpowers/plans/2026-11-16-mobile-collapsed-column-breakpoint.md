# Collapsed Column Breakpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen a column that was collapsed on a phone when the viewport leaves the 600px mobile breakpoint, so its widgets are never trapped unmounted behind a hidden toggle.

**Architecture:** `MobileColumn` in `src/client/pages/PageView.tsx` owns the `open` state and conditionally renders children (`{open ? <div ref={contentRef}>{children}</div> : null}`), while `page.module.css` hides the toggle above 600px. Add one unconditional `useEffect` that subscribes to `matchMedia("(max-width: 600px)")` and forces `open=true` when the query stops matching. The effect only ever opens, never closes, so focus-restore in `handleToggle` and all other collapse behavior stay unchanged.

**Tech Stack:** Bun 1.4.4, React 19 (hooks, `memo`), strict TypeScript, Vitest 5 with jsdom, CSS-module media query at `max-width: 600px`.

**Spec:** `/tmp/mobile-findings.md` — finding M03, reproduced verbatim:

> M03 — Collapsed column invisible over 600px (CORRECTNESS-01, S, HIGH)
> Evidence: `src/client/pages/PageView.tsx:545` `useState(true)`, `:582` children only rendered when open; toggle hidden above 600px (`page.module.css:174-175`, `:425-427`). Impact: collapse on phone then rotate → section unmounted and unreopenable until reload. Fix: `matchMedia("(max-width: 600px)")` listener in `MobileColumn` that forces `open=true` when leaving mobile; keep focus-restore. Test in `PageView.test.tsx`: stub matchMedia, collapse, fire change to false, assert children rendered.

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

Executor note: the orchestrator owns commits, so each task ends with a verification command rather than a commit step.

## Review Focus

- Rotating a collapsed phone from ≤600px to >600px must remount the widgets — pinned by Task 1, `reopens a collapsed column when the viewport leaves mobile`.
- `aria-expanded` must agree with the rendered children after the forced open — pinned by Task 1, the same test's two post-transition assertions.
- Leaving mobile while already open must be a stable no-op — pinned by Task 1, `leaves an already-open column open when the viewport leaves mobile`.
- Re-entering mobile must not auto-close a column — pinned by Task 1, `does not auto-close a column when re-entering mobile`.
- A column unmounted after a resize must not leave a live listener behind — pinned by Task 1, `removes its matchMedia listener on unmount`.

---

### Task 1: Force columns open on leaving the mobile breakpoint

**Files:**
- Modify: `src/client/pages/PageView.tsx:532-558` (add the effect inside `MobileColumn`)
- Modify: `src/client/pages/PageView.test.tsx` (add a `mobileMedia()` helper after `renderPage` at line 89, and four tests)
- Reference (do not edit): `src/client/pages/page.module.css:174-175`, `src/client/pages/page.module.css:425-427`

**Interfaces:**
- Consumes: `window.matchMedia`, `useEffect`, and the existing `open` state / `setOpen` setter in `MobileColumn`.
- Produces: no new exports; `aria-expanded` on `[data-testid="column-toggle"]` becomes `true` and the column's children remount after a `change` event on the `(max-width: 600px)` `MediaQueryList` reports `matches: false`.

- [ ] **Step 1: Add the controllable matchMedia stub to the test file**

Insert this helper immediately after `renderPage` in `src/client/pages/PageView.test.tsx` (the file already imports `act`, `fireEvent`, `screen` and `vi`):

```tsx
function mobileMedia() {
	const change: Array<() => void> = [];
	const mql = {
		matches: true,
		media: "(max-width: 600px)",
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn((type: string, cb: () => void) => {
			if (type === "change") change.push(cb);
		}),
		removeEventListener: vi.fn((type: string, cb: () => void) => {
			if (type === "change") {
				const i = change.indexOf(cb);
				if (i >= 0) change.splice(i, 1);
			}
		}),
		dispatchEvent: vi.fn(),
	};
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) =>
			query === "(max-width: 600px)"
				? mql
				: {
						matches: false,
						media: query,
						onchange: null,
						addListener: vi.fn(),
						removeListener: vi.fn(),
						addEventListener: vi.fn(),
						removeEventListener: vi.fn(),
						dispatchEvent: vi.fn(),
					},
		),
	);
	return {
		leaveMobile() {
			mql.matches = false;
			for (const cb of [...change]) cb();
		},
		enterMobile() {
			mql.matches = true;
			for (const cb of [...change]) cb();
		},
		count() {
			return change.length;
		},
	};
}
```

Calling this inside a test overrides the file's `beforeEach` matchMedia stub; all other queries keep the existing desktop default (`matches: false`).

- [ ] **Step 2: Write the four failing tests**

Add these tests to the existing `describe` block in `src/client/pages/PageView.test.tsx`:

```tsx
	it("reopens a collapsed column when the viewport leaves mobile", async () => {
		const media = mobileMedia();
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Clock" }, data: null }],
					},
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		const toggle = screen.getByTestId("column-toggle");
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByTestId("clock-widget")).toBeNull();
		await act(async () => {
			media.leaveMobile();
		});
		expect(screen.getByTestId("column-toggle")).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("clock-widget")).toBeTruthy();
	});

	it("leaves an already-open column open when the viewport leaves mobile", async () => {
		const media = mobileMedia();
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Clock" }, data: null }],
					},
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		await act(async () => {
			media.leaveMobile();
		});
		expect(screen.getByTestId("column-toggle")).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("clock-widget")).toBeTruthy();
	});

	it("does not auto-close a column when re-entering mobile", async () => {
		const media = mobileMedia();
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Clock" }, data: null }],
					},
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		fireEvent.click(screen.getByTestId("column-toggle"));
		await act(async () => {
			media.leaveMobile();
			media.enterMobile();
		});
		expect(screen.getByTestId("column-toggle")).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("clock-widget")).toBeTruthy();
	});

	it("removes its matchMedia listener on unmount", () => {
		const media = mobileMedia();
		const { unmount } = renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Clock" }, data: null }],
					},
				],
			}),
		);
		expect(media.count()).toBeGreaterThan(0);
		unmount();
		expect(media.count()).toBe(0);
	});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test src/client/pages/PageView.test.tsx -t "viewport leaves mobile"`
Expected: FAIL — after `media.leaveMobile()`, `aria-expanded` is still `"false"` and `queryByTestId("clock-widget")` is still `null`.

- [ ] **Step 4: Implement the listener in `MobileColumn`**

In `src/client/pages/PageView.tsx`, immediately after `const [open, setOpen] = useState(true);` (line 545), add:

```tsx
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 600px)");
		const onChange = () => {
			if (!mq.matches) setOpen(true);
		};
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
```

`useEffect` is already imported at line 12. Do not change `handleToggle` (its focus-restore to `toggleRef` when closing is part of the contract) or any CSS.

- [ ] **Step 5: Run the tests and gates to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: PASS, including all four new tests and the existing column tests.
Run: `bun check`
Expected: no type errors.
Run: `biome lint src/client/pages/PageView.tsx src/client/pages/PageView.test.tsx`
Expected: no diagnostics.
Run: `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`
Expected: no formatting differences (the orchestrator formats once, outside this plan).
