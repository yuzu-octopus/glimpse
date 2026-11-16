# HTML Widget Overflow Containment (M10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep wide author-supplied HTML in the `html` widget inside its own card instead of widening the page on a phone.

**Architecture:** The `Html` renderer injects the author's markup verbatim into one `.html` div, whose only rule today is `font-size: 14px`. Give that wrapper `overflow-x: auto` and `overflow-wrap: anywhere`, and cap the usual overflow-prone descendants (`img`, `table`, `pre`, `video`) at `max-width: 100%`. Export `Html` as a named export so a component test can render it directly; the default export (`Iframe`) and both `registerWidgetComponent` calls stay unchanged. No sanitization — this widget's contract is rendering the author's own markup.

**Tech Stack:** React 19, TypeScript (strict), CSS Modules, Astryx/Dracula design tokens, Vitest + Testing Library, Bun 1.4.4.

**Spec:** `/tmp/mobile-findings.md`, finding **M10** plus "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.
- Orchestrator-only gates after the wave: `bun run test <file>`, `bun check`, `biome lint <file>`, `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`. Implementers run only the per-task test command below.

## Review Focus

- **A wide `<table>` in author markup** — a reader expects a horizontal scrollbar inside the widget, not a page-level sideways scroll. Pin: render a wide table, assert the wrapper carries `styles.html`, and assert the `overflow-x: auto` declaration in source.
- **A long unbroken token or URL** — it must wrap rather than stretch the card. Pin: source assertion for `overflow-wrap: anywhere`.
- **Oversized `<img>` and `<video>`** — media must never exceed the card width. Pin: source assertion for the descendant `max-width: 100%` rule, including both selectors.
- **`<pre>` code blocks** — preformatted content must not be the one escape hatch. Pin: the same rule's `pre` selector is asserted.
- **The plain `iframe` widget** — containment added for `html` must not change framed embeds. Pin: all pre-existing `iframe widget` tests in the same file must still pass, and `.frame` stays untouched.

---

### Task 1: Contain injected HTML and cover it with a component test

**Files:**
- Modify: `src/client/widgets/iframe/index.tsx:25` (named export for `Html`)
- Modify: `src/client/widgets/iframe/iframe.module.css:8-10` (the `.html` rule plus descendant rule)
- Test: `src/client/widgets/iframe/iframe.test.tsx` (add imports and one case; existing cases stay)

**Interfaces:**
- Consumes: `WidgetComponentProps`, `HtmlConfig` (`source`), `WidgetChrome`, `styles.html` from `iframe.module.css`.
- Produces: named export `Html(WidgetComponentProps) => JSX.Element`; default export remains `Iframe`; `.html` becomes a containing scrollport, and descendant media/table/pre rules cap width.

- [ ] **Step 1: Write the failing component test**

At the top of `src/client/widgets/iframe/iframe.test.tsx`, add `import { readFileSync } from "node:fs";` and change the component import to `import Iframe, { Html as HtmlWidget } from "./index";`, plus `import styles from "./iframe.module.css";`. Then add:

```ts
describe("html widget overflow containment", () => {
	const css = readFileSync("src/client/widgets/iframe/iframe.module.css", "utf8");

	it("wraps author markup in a wrapping scrollport and caps wide descendants", () => {
		render(
			<HtmlWidget
				config={{ type: "html", source: "<table><tr><td>very-wide-cell</td></tr></table>" }}
				data={null}
			/>,
		);
		const wrapper = screen.getByText("very-wide-cell").closest("div");
		expect(wrapper?.className).toContain(styles.html);
		expect(css).toMatch(/\.html\s*\{[^}]*overflow-x:\s*auto/);
		expect(css).toMatch(/\.html\s*\{[^}]*overflow-wrap:\s*anywhere/);
		expect(css).toMatch(
			/\.html\s+img\s*,\s*\.html\s+table\s*,\s*\.html\s+pre\s*,\s*\.html\s+video\s*\{[^}]*max-width:\s*100%/,
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/widgets/iframe/iframe.test.tsx`
Expected: FAIL — `Html` is not a named export yet and the CSS declarations are absent.

- [ ] **Step 3: Export the `Html` renderer in `src/client/widgets/iframe/index.tsx`**

Change `function Html({ config }: WidgetComponentProps) {` to `export function Html({ config }: WidgetComponentProps) {`. Do not alter its body, the `biome-ignore` comment above the injected div, the default export, or the two registration calls.

- [ ] **Step 4: Add containment rules in `src/client/widgets/iframe/iframe.module.css`**

Replace the current `.html` rule with exactly:

```css
.html {
	font-size: 14px;
	overflow-x: auto;
	overflow-wrap: anywhere;
}

.html img,
.html table,
.html pre,
.html video {
	max-width: 100%;
}
```

Leave `.frame` untouched. Do not add hex colours, custom classes in JSX, or a sanitizer.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test src/client/widgets/iframe/iframe.test.tsx`
Expected: PASS, including all five pre-existing `iframe widget` cases.


