# Custom-API Value Column Shrink (M11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a long custom-api value or timestamp shrink and truncate with a tooltip instead of squeezing the title column off the row.

**Architecture:** `.rowRight` is a kit `Stack` with `flex-shrink: 0`, so it keeps its intrinsic width and the only shrinkable column (`.rowBody`) collapses when an API returns a long value. Replace `flex-shrink: 0` with `min-width: 0` so the right column can shrink, and give both trailing `Text` nodes `maxLines={1}`. The kit's `Text` shows a truncate tooltip by default when `maxLines > 0`, so no extra tooltip wiring or `hasTruncateTooltip` prop is needed. The title already clamps at one line; icon and image keep their fixed widths.

**Tech Stack:** React 19, @astryxdesign/core kit (`HStack`, `Stack`, `Text`, `Link`, `Icon`), CSS Modules, Vitest + Testing Library, Bun 1.4.4.

**Spec:** `/tmp/mobile-findings.md`, finding **M11** plus "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.
- Orchestrator-only gates after the wave: `bun run test <file>`, `bun check`, `biome lint <file>`, `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`. Implementers run only the per-task test command below.

## Review Focus

- **A very long single-token value** — a reader expects the title to stay readable and the value to clamp. Pin: render a 240-character value and assert `-webkit-line-clamp: 1` on it.
- **A long timestamp** — the metadata must follow the same rule, not become the new widest node. Pin: assert the same clamp on the rendered timestamp.
- **Tooltip on the truncated value** — hovering a clipped value must reveal the full string; the kit default supplies it. Pin: assert the source does not set `hasTruncateTooltip={false}` on either trailing `Text`.
- **Rows with no image or icon** — the fix must not rely on a leading thumbnail being present. Pin: the test item reuses `items[0]` minus extras, exercising the text-only path.
- **Frameless mode and fixed thumbnails** — the same `ItemRow` renders in both shells, and icons/images must not start shrinking. Pin: existing frameless and star-icon tests stay green, and the CSS source still gives `.icon`/`.image` `flex-shrink: 0`.

---

### Task 1: Make the trailing column shrinkable and clamp its text

**Files:**
- Modify: `src/client/widgets/custom-api/custom-api.module.css:25-27` (the `.rowRight` rule)
- Modify: `src/client/widgets/custom-api/index.tsx:50-57` (value and timestamp `Text` props)
- Test: `src/client/widgets/custom-api/custom-api.test.tsx` (add a `readFileSync` import and one case)

**Interfaces:**
- Consumes: `CustomApiItem.value` and `.timestamp`, `styles.rowRight`, kit `Text` (`maxLines` defaults `hasTruncateTooltip` to true).
- Produces: a shrinkable `.rowRight` Stack (`min-width: 0`, no `flex-shrink: 0`); value and timestamp rendered as single-line clamped `Text` with the kit tooltip.

- [ ] **Step 1: Write the failing component test**

Add `import { readFileSync } from "node:fs";` to `src/client/widgets/custom-api/custom-api.test.tsx`, then add this case inside the existing `describe`:

```ts
it("shrinks a long value and timestamp to one line without disabling the tooltip", () => {
	const longValue = "a".repeat(240);
	render(
		<CustomApi
			config={{ type: "custom-api", title: "CI" }}
			data={{ items: [{ ...items[0], value: longValue, image: null, icon: null }], frameless: false }}
		/>,
	);

	expect(screen.getByText(longValue)).toHaveStyle({ "-webkit-line-clamp": "1" });
	expect(screen.getByText("2m ago")).toHaveStyle({ "-webkit-line-clamp": "1" });

	const css = readFileSync("src/client/widgets/custom-api/custom-api.module.css", "utf8");
	expect(css).toMatch(/\.rowRight\s*\{[^}]*min-width:\s*0/);
	expect(css).not.toMatch(/\.rowRight\s*\{[^}]*flex-shrink:\s*0/);
	const jsx = readFileSync("src/client/widgets/custom-api/index.tsx", "utf8");
	expect(jsx).not.toMatch(/hasTruncateTooltip=\{false\}/);
	expect(css).toMatch(/\.icon\s*\{[^}]*flex-shrink:\s*0/);
	expect(css).toMatch(/\.image\s*\{[^}]*flex-shrink:\s*0/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/widgets/custom-api/custom-api.test.tsx`
Expected: FAIL — `.rowRight` still has `flex-shrink: 0`, and the value/timestamp are not clamped.

- [ ] **Step 3: Make `.rowRight` shrinkable in `custom-api.module.css`**

Replace the `.rowRight` block with:

```css
.rowRight {
	min-width: 0;
}
```

Touch no other rule: `.rowBody`, `.icon`, and `.image` must keep their current `min-width: 0` / `flex-shrink: 0` declarations.

- [ ] **Step 4: Clamp the trailing values in `src/client/widgets/custom-api/index.tsx`**

Add `maxLines={1}` to the value `Text` (the one with `type="body" weight="semibold" hasTabularNumbers`) and to the timestamp `Text` (the one with `type="supporting"`). Keep all existing props and conditional rendering; do not add `hasTruncateTooltip` — the kit's default is the tooltip.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test src/client/widgets/custom-api/custom-api.test.tsx`
Expected: PASS, including the pre-existing text-tier, frameless, loading, error, and star-icon cases.


