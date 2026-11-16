# JS/CSS breakpoint mismatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the JS tile placer and the CSS mobile rules agree on one 600px viewport breakpoint, eliminating the 601–632px band where tiles are single-track but mobile toggles are missing.

**Architecture:** `trackCountForWidth()` is correct in isolation; the bug is its input. `usePlacedWidth()` feeds it `el.clientWidth` (viewport minus the 16px per-side page inset), while `page.module.css` flips at viewport `max-width: 600px`. At 601–632px viewport the measured content box is 569–600px, so JS picks 1 track and CSS stays in desktop mode. Because `place()` uses its width argument *only* to choose the track count (geometry comes from `ROW_UNIT`/`gridRowHeight`), the fix is to feed it `window.innerWidth` at all three call sites. `place()` itself is unchanged.

**Tech Stack:** Bun 1.4.4, React 19, CSS media queries, Vitest with `@testing-library/react`.

**Spec:** `/tmp/mobile-findings.md` — finding M06 and "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- `MOBILE_MAX_WIDTH` (600) is the single JS value; it must stay equal to the CSS `@media (max-width: 600px)` literal.
- Every task ends with a checkable test/command; implementers do **not** run formatters or repo-wide gates — the orchestrator runs them once per wave.
- One atomic commit per completed plan; commit message names the plan file. No push.
- Wave gates (orchestrator only): `bun check`; `biome lint <each edited TS/TSX file>`; `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`.
- Per-task test commands: `bun run test src/client/pages/PageView.test.tsx`; `bun run test src/client/pages/tiling.test.ts`.

## Review Focus

- **632px viewport / 600px content box:** must yield 6 tracks, not 1. Pinned by Task 1 step 1 (boundary test that stubs `innerWidth=632` and `clientWidth=600`).
- **Crossing 600px live:** resizing from 632px to 600px must switch the placed track count without a remount. Pinned by Task 1 step 5 (resize assertion in the same test).
- **600px viewport:** 1 track *and* the mobile column toggle must be active; both sides must read the same literal. Pinned by Task 1 step 6 (pure boundary table) and Task 2 step 1 (CSS source parity assertion).
- **Skeleton vs live geometry:** the skeleton and ready page must place identically at the same viewport. Pinned by Task 2 step 2 (source check that every `place()` width call site uses the same hook).

---

### Task 1: Feed the placer the viewport width

**Files:**
- Modify: `src/client/pages/PageView.tsx` (replace `usePlacedWidth` at lines 118-136; update the three calls at lines 156, 629, 851)
- Test: `src/client/pages/PageView.test.tsx`
- Test: `src/client/pages/tiling.test.ts`

**Interfaces:**
- Consumes: `place(tiles, width, opts?)`, `trackCountForWidth(width)`, `MOBILE_MAX_WIDTH`, `TABLET_MAX_WIDTH` from `src/client/pages/tiling.ts`.
- Produces: `useViewportWidth(): number` (local to `PageView.tsx`) returning `window.innerWidth` and updating on the `resize` event; `gridRef` remains as the DOM ref passed to `ColumnGrid`/attached to the grid, it is no longer read for width.

- [ ] **Step 1: Write the failing boundary test**

Add to `src/client/pages/PageView.test.tsx`, reusing the file's `payload()` helper and `renderPage()` helper:

```tsx
it("uses the viewport, not the measured content box, for the tiling breakpoint", async () => {
	const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
	Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 632 });
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get: () => 600,
	});
	try {
		renderPage(
			payload({
				widgets: [
					{ type: "clock", config: { type: "clock" }, data: null },
					{ type: "clock", config: { type: "clock" }, data: null },
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		expect(screen.getByTestId("bento-grid").style.getPropertyValue("--bento-cols")).toBe("6");
	} finally {
		Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth ?? {
			configurable: true,
			get: () => 0,
		});
		Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
	}
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: FAIL — `--bento-cols` is `"1"` because the hook measured the 600px content box.

- [ ] **Step 3: Replace the width hook**

In `src/client/pages/PageView.tsx`, replace the body of `usePlacedWidth(ref)` (lines 118-136) with a ref-free hook:

```tsx
/** Viewport width — the same input the CSS @media breakpoints use. */
function useViewportWidth(): number {
	const [width, setWidth] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth : 1280,
	);
	useEffect(() => {
		const onResize = () => setWidth(window.innerWidth);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	return width;
}
```

Update all three call sites to `const width = useViewportWidth();` (PageSkeleton line 156, BentoGrid line 629, PageView line 851). Keep each `gridRef` declaration and DOM attachment unchanged. Do not change `trackCountForWidth`, `place()` or any grid CSS.

- [ ] **Step 4: Run the boundary test to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Pin live resize across the breakpoint**

Extend the test from step 1: after the first assertion, in an `act()` block set `window.innerWidth = 600`, dispatch `new Event("resize")` on `window`, and assert `screen.getByTestId("bento-grid").style.getPropertyValue("--bento-cols")` is `"1"`. Keep the `try/finally` restoration.

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: PASS.

- [ ] **Step 6: Add the pure boundary table**

In `src/client/pages/tiling.test.ts`, extend `describe("trackCountForWidth", ...)` with a table asserting `600 → 1`, `601 → 6`, `632 → 6`, `900 → 6`, `901 → 12`, with a comment that 632 is `600 + 2 × 16px page inset` and is the band this plan removes.

Run: `bun run test src/client/pages/tiling.test.ts`
Expected: PASS (the pure function was always correct; the test documents the contract the hook now honours).

### Task 2: Lock CSS/JS breakpoint parity

**Files:**
- Test: `src/client/pages/PageView.test.tsx`
- Test: `src/client/pages/tiling.test.ts`

**Interfaces:**
- Consumes: `MOBILE_MAX_WIDTH` exported from `src/client/pages/tiling.ts`; the shipped CSS at `src/client/pages/page.module.css`.
- Produces: two regression assertions that fail if either side's 600px value changes independently.

- [ ] **Step 1: Assert the CSS mobile block and the JS constant agree**

Add to `src/client/pages/PageView.test.tsx` (imports: `readFileSync` from `node:fs`, `MOBILE_MAX_WIDTH` from `./tiling`):

```tsx
it("drives mobile toggles from the same 600px viewport breakpoint as the placer", () => {
	const css = readFileSync("src/client/pages/page.module.css", "utf8");
	expect(MOBILE_MAX_WIDTH).toBe(600);
	// Brace-match the @media block rather than regexing to the first closing brace:
	// nested blocks inside it are what make a naive regex stop early.
	const at = css.indexOf("@media (max-width: 600px) {");
	expect(at).toBeGreaterThanOrEqual(0);
	let depth = 0;
	let end = at;
	for (let i = at; i < css.length; i++) {
		if (css[i] === "{") depth++;
		else if (css[i] === "}") {
			depth--;
			if (depth === 0) { end = i; break; }
		}
	}
	const block = css.slice(at, end);
	expect(block).toContain(".mobileToggle");
	expect(block).toMatch(/\.mobileToggle\s*\{[^}]*display:\s*inline-flex/);
});
```

- [ ] **Step 2: Assert all geometry call sites share one width source**

Add to `src/client/pages/tiling.test.ts`:

```ts
import { readFileSync } from "node:fs";
it("uses one viewport-based width for live and skeleton placement", () => {
	const src = readFileSync("src/client/pages/PageView.tsx", "utf8");
	expect(src).toContain("function useViewportWidth()");
	expect(src).not.toContain("usePlacedWidth");
	expect(src.match(/const width = useViewportWidth\(\);/g)).toHaveLength(3);
});
```

Run: `bun run test src/client/pages/tiling.test.ts && bun run test src/client/pages/PageView.test.tsx`
Expected: PASS.


