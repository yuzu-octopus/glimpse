# Pull-to-Refresh Inner Scrollers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop pull-to-refresh from hijacking touch gestures that begin inside dialogs or inner scrollers, while keeping page-level pull-to-refresh working.

**Architecture:** `PullToRefresh` attaches window touch listeners and currently claims any downward gesture once `delta > 8`, calling `preventDefault` with no target check. Add a pure helper, `isInnerScrollerTarget(target)`, that walks from the event target up to (but excluding) `document.body` / `document.documentElement` and returns true for a `<dialog>` or an element whose computed `overflowY`/`overflowX` is `auto`/`scroll` with scrollable extent in that axis. `onTouchStart` clears `startYRef` when the helper says true, so the existing touchmove/touchend logic is a no-op: no `preventDefault`, no refresh. The page scrollport remains the only PTR owner.

**Tech Stack:** Bun 1.4.4, React 19, strict TypeScript, Vitest 5 with jsdom, plain CSS (`overflow-y: auto` in `settings-panel.module.css`, `overflow-x: auto` rails in feed/videos/rss/reddit).

**Spec:** `/tmp/mobile-findings.md` — finding M04, reproduced verbatim:

> M04 — PTR hijacks inner scrollers (CORRECTNESS-02, M, HIGH)
> Evidence: `src/client/components/PullToRefresh.tsx:49-80` window touch listeners; `atTop()` only checks `window.scrollY`; `preventDefault` at delta>8; no target check. Inner scrollers: `settings-panel.module.css:45-53` content overflow-y auto, feed/videos/rss/reddit `overflow-x:auto` rails. Impact: downward swipe in settings or rail cancels native scroll and can trigger full cache-busting reload. Fix: on touchstart ignore gestures whose target is inside `<dialog>` or any ancestor with computed `overflowY`/`overflowX` auto|scroll that can scroll in the gesture direction; mark page scrollport as the only PTR owner. Test: dispatch touchstart with a target inside a fake scrollable ancestor; assert no `preventDefault` and no refresh on release.

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

Executor note: the orchestrator owns commits, so each task ends with a verification command rather than a commit step.

## Review Focus

- A downward swipe in the settings panel's `overflow-y: auto` content must scroll natively, not refresh — pinned by Task 1, `ignores a downward gesture that starts inside an inner scroller`.
- A swipe inside the feed/video/rss/reddit horizontal rails must not be captured — pinned by Task 1, `ignores a gesture that starts inside a horizontally scrollable rail`.
- Settings content lives inside Astryx's `<Dialog>`; any gesture starting there must be ignored regardless of scroll extent — pinned by Task 1, `ignores a gesture that starts inside a dialog`.
- Ordinary page content must still pull to refresh (no over-correction) — pinned by Task 1, `still refreshes from the page scrollport`.
- `overflow: auto` without actual scrollable extent is not an inner scroller and must not suppress PTR — pinned by Task 1, `does not suppress PTR for an overflow container with no scrollable extent`.

---

### Task 1: Pin the target-filtering behavior with failing tests

**Files:**
- Modify: `src/client/components/PullToRefresh.test.tsx` (add helpers, extend `afterEach`, add five tests)
- Reference (do not edit): `src/client/components/settings-panel.module.css:45-53`, `src/client/widgets/feed/feed.module.css:10-13`

**Interfaces:**
- Consumes: the existing `PullToRefresh` component and its window touch listeners; no new production API exists yet.
- Produces: test fixtures and five tests that call the eventual helper indirectly through the component; the helper's name is fixed in Task 2.

- [ ] **Step 1: Add test fixtures for inner scrollers**

At the top of `src/client/components/PullToRefresh.test.tsx`, after the existing `dispatch` helper (line 12), add:

```tsx
function dispatchFrom(type: string, y: number, target: EventTarget): Event {
	const e = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
	target.dispatchEvent(e);
	return e;
}

function fixture(axis: "y" | "x" | "none", tag = "div"): HTMLElement {
	const original = window.getComputedStyle;
	const el = document.createElement(tag);
	el.setAttribute("data-ptr-fixture", "");
	el.style.overflowY = axis === "x" ? "visible" : "auto";
	el.style.overflowX = axis === "y" ? "visible" : "auto";
	Object.defineProperty(el, "scrollHeight", { value: axis === "y" ? 500 : 100 });
	Object.defineProperty(el, "clientHeight", { value: 100 });
	Object.defineProperty(el, "scrollWidth", { value: axis === "x" ? 500 : 100 });
	Object.defineProperty(el, "clientWidth", { value: 100 });
	vi.spyOn(window, "getComputedStyle").mockImplementation((node: Element) =>
		node === el ? el.style : original.call(window, node),
	);
	const child = document.createElement("span");
	el.append(child);
	document.body.append(el);
	return child;
}
```

Extend the existing `afterEach` so fixtures cannot leak between tests:

```tsx
afterEach(() => {
	vi.restoreAllMocks();
	for (const el of document.body.querySelectorAll("[data-ptr-fixture]")) el.remove();
});
```

- [ ] **Step 2: Write the five failing/regression tests**

Add these tests inside the existing `describe("PullToRefresh", ...)` block:

```tsx
	it("ignores a downward gesture that starts inside an inner scroller", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("y");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("ignores a gesture that starts inside a horizontally scrollable rail", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("x");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("ignores a gesture that starts inside a dialog", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("none", "dialog");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("still refreshes from the page scrollport", async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 0);
		dispatch("touchmove", 200);
		dispatch("touchend", 200);

		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
	});

	it("does not suppress PTR for an overflow container with no scrollable extent", async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("none");
		dispatchFrom("touchstart", 0, target);
		dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
	});
```

- [ ] **Step 3: Run the tests to verify the new cases fail**

Run: `bun run test src/client/components/PullToRefresh.test.tsx`
Expected: FAIL on `ignores a downward gesture that starts inside an inner scroller` (`move.defaultPrevented` is `true` and `onRefresh` was called); the two positive-control tests pass.

---

### Task 2: Implement the target filter and wire it into touchstart

**Files:**
- Create: `src/client/components/pull-to-refresh-target.ts`
- Modify: `src/client/components/PullToRefresh.tsx:1-3` (add import), `src/client/components/PullToRefresh.tsx:48-54` (guard in `onTouchStart`)

**Interfaces:**
- Consumes: `EventTarget`, `Element`, `getComputedStyle`, `document.body` and `document.documentElement` from the DOM.
- Produces: `export function isInnerScrollerTarget(target: EventTarget | null): boolean`; imported only by `PullToRefresh.tsx`. Returns true when `target` is (or is inside) a `<dialog>` or an element with computed `overflowY`/`overflowX` of `"auto"`/`"scroll"` and corresponding `scrollHeight > clientHeight` / `scrollWidth > clientWidth`; stops before `body`/`html`; returns false for non-element targets.

- [ ] **Step 1: Implement the helper**

Create `src/client/components/pull-to-refresh-target.ts`:

```ts
export function isInnerScrollerTarget(target: EventTarget | null): boolean {
	let node: Element | null = target instanceof Element ? target : null;
	while (node && node !== document.body && node !== document.documentElement) {
		if (node.tagName === "DIALOG") return true;
		const style = getComputedStyle(node);
		const canScrollY =
			(style.overflowY === "auto" || style.overflowY === "scroll") &&
			node.scrollHeight > node.clientHeight;
		const canScrollX =
			(style.overflowX === "auto" || style.overflowX === "scroll") &&
			node.scrollWidth > node.clientWidth;
		if (canScrollY || canScrollX) return true;
		node = node.parentElement;
	}
	return false;
}
```

- [ ] **Step 2: Guard `onTouchStart`**

Add `import { isInnerScrollerTarget } from "./pull-to-refresh-target";` to `src/client/components/PullToRefresh.tsx`. In `onTouchStart`, after the existing early return for `refreshingRef.current || !atTop() || e.touches.length !== 1`, insert:

```tsx
		if (isInnerScrollerTarget(e.target)) {
			startYRef.current = null;
			engagedRef.current = false;
			return;
		}
```

Do not add any check to `onTouchMove`/`onTouchEnd`; a null `startY` already makes them no-ops.

- [ ] **Step 3: Run the tests and gates to verify it passes**

Run: `bun run test src/client/components/PullToRefresh.test.tsx`
Expected: PASS (all existing tests plus the five new ones).
Run: `bun run test src/client/components/SettingsPanel.test.tsx`
Expected: PASS (dialog/side-nav regression).
Run: `bun check`
Expected: no type errors.
Run: `biome lint src/client/components/pull-to-refresh-target.ts src/client/components/PullToRefresh.tsx src/client/components/PullToRefresh.test.tsx`
Expected: no diagnostics.
Run: `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`
Expected: no formatting differences (the orchestrator formats once, outside this plan).
