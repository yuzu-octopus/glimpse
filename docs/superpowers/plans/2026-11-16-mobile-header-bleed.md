# Mobile Header Bleed (M09) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the mobile page-name header from extending 8px past the page's own horizontal inset on phones.

**Architecture:** `.mobileHeader` uses a negative inline margin to cancel the page's padding, but it cancels `--content-bounds-padding` (alias of `--space-gap`, 24px) while `.page` insets by `--space-viewport` (16px) — an 8px overhang per side. Change the inline margin term to `--space-viewport` and add `overflow-x: clip` on `body` as a defence against any remaining horizontal bleed. No JSX changes; the sticky strip, its z-index, borders, and block margins stay exactly as they are.

**Tech Stack:** React 19, TypeScript (strict), CSS Modules, Astryx/Dracula design tokens, Vitest + Testing Library, Bun 1.4.4.

**Spec:** `/tmp/mobile-findings.md`, finding **M09** plus "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.
- Orchestrator-only gates after the wave: `bun run test <file>`, `bun check`, `biome lint <file>`, `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`. Implementers run only the per-task test command below.

## Review Focus

- **Wider layouts where `--content-bounds-padding` and `--space-viewport` diverge** — a reader expects the strip to match the page inset at every width. Pin: the header rule asserts `var(--space-viewport)` and no longer mentions `--content-bounds-padding`.
- **A wide widget scrolled under the sticky strip** — the reader expects no page-level sideways scroll from the header. Pin: `body` rule asserts `overflow-x: clip`.
- **Rotation from phone to tablet while the strip is visible** — the fix must not depend on a media query, so the correction cannot disappear at a breakpoint. Pin: assertions read the base `.mobileHeader` rule, not a `@media` slice.
- **A token resolves to zero or is overridden by a theme** — `calc(-1 * var(--space-viewport))` degrades to 0 rather than a fixed pixel overhang. Pin: exact `calc(-1 * var(--space-viewport))` term asserted in the margin shorthand.
- **The strip's vertical placement and stickiness** — changing the horizontal term must not disturb top/bottom gaps or sticky behaviour. Pin: the same assertion checks the unchanged `var(--widget-gap)` first and third margin terms.

---

### Task 1: Align the mobile header's negative inset with the page inset and clip page-level overflow

**Files:**
- Modify: `src/client/pages/page.module.css:47` (the `.mobileHeader` margin shorthand)
- Modify: `src/index.css:57-67` (the `body` rule)
- Test: `src/client/pages/PageView.test.tsx` (add a case beside the existing page-layout CSS assertions near line 788; `readFileSync` is already imported there)

**Interfaces:**
- Consumes: `--space-viewport` (16px, from astryx-dracula `tokens.css`), `--widget-gap`, and the existing `.page { padding-inline: var(--space-viewport) }` rule.
- Produces: `.mobileHeader`'s inline overhang equals the page inset; `body` clips horizontal overflow while keeping `overflow-y: scroll`.

- [ ] **Step 1: Write the failing CSS-invariant test**

Add to `src/client/pages/PageView.test.tsx`:

```ts
it("mobile header bleeds exactly the page inset and the page clips horizontal overflow", () => {
	const pageCss = readFileSync("src/client/pages/page.module.css", "utf8");
	const globalCss = readFileSync("src/index.css", "utf8");
	const start = pageCss.indexOf(".mobileHeader");
	const header = pageCss.slice(start, pageCss.indexOf("}", start));

	// The page insets by --space-viewport; the strip must cancel that same token.
	expect(pageCss).toMatch(/\.page\s*\{[^}]*padding-inline:\s*var\(--space-viewport\)/);
	expect(header).toMatch(
		/margin:\s*calc\(-1 \* var\(--widget-gap\)\) calc\(-1 \* var\(--space-viewport\)\) var\(--widget-gap\)/,
	);
	expect(header).not.toMatch(/--content-bounds-padding/);
	expect(globalCss).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: FAIL — the header margin still contains `--content-bounds-padding` and `body` has no `overflow-x`.

- [ ] **Step 3: Change only the inline margin term in `src/client/pages/page.module.css:47`**

Replace `calc(-1 * var(--content-bounds-padding))` with `calc(-1 * var(--space-viewport))` in the `.mobileHeader` shorthand. Keep `calc(-1 * var(--widget-gap))` as the first term and `var(--widget-gap)` as the third; do not touch any other declaration or media query.

- [ ] **Step 4: Add the horizontal clip to the `body` rule in `src/index.css`**

Add `overflow-x: clip;` immediately after the existing `overflow-y: scroll;` in the `body` block (line 57-67). Do not change `overflow-y`, margins, colours, or fonts.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test src/client/pages/PageView.test.tsx`
Expected: PASS, including all pre-existing cases in that file.


