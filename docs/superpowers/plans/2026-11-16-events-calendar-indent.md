# Events-Calendar Magic Indent (M12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align an event's location under its title with a real two-track grid instead of a hard-coded 92px left padding.

**Architecture:** `.event` currently stacks a `.top` flex row (`time` + `title`) above a `.location` div that is indented by a magic `padding-left: 92px` — a value that silently drifts if the time font, the 84px min-width, or the 8px gap changes. Convert `.event` into a two-column grid, `minmax(84px, auto) minmax(0, 1fr)`, and make time, title, and location direct children placed in columns 1, 2, and 2 respectively. The location then inherits the title track with no magic number, and the title gets a genuinely flexible `minmax(0, 1fr)` track so long names ellipsize. Event grouping, day headers, and `timeRange()` are untouched.

**Tech Stack:** React 19, TypeScript (strict), CSS Grid, CSS Modules, Vitest + Testing Library, Bun 1.4.4.

**Spec:** `/tmp/mobile-findings.md`, finding **M12** plus "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.
- Orchestrator-only gates after the wave: `bun run test <file>`, `bun check`, `biome lint <file>`, `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`. Implementers run only the per-task test command below.

## Review Focus

- **A long event title on a narrow phone** — a reader expects the time to stay visible and the title to ellipsize inside its own track. Pin: CSS source asserts `minmax(0, 1fr)` on `.event`, and the component test asserts the title text is still rendered in the title slot.
- **A short time label such as "All day"** — the time track must not collapse and shift the title. Pin: the existing "All day" assertion stays green and the source asserts the `minmax(84px, auto)` time track.
- **An event with no location** — the row must still show time and title without an empty indented line. Pin: the existing "Retro" case stays green; the location element is conditionally rendered exactly as before.
- **A location longer than the title** — it must follow the title track, not a fixed indent. Pin: component test asserts `.location` is a direct child of the same `.event` grid and contains "Room 4"; source asserts no `padding-left: 92px` remains.
- **Screen-reader structure** — day sections and visible text must be unchanged by the markup reshape. Pin: the existing `getByRole("region", ...)` assertions and empty-state case stay green.

---

### Task 1: Replace the magic indent with a two-track event grid

**Files:**
- Modify: `src/client/widgets/events-calendar/index.tsx:71-78` (event chip markup)
- Modify: `src/client/widgets/events-calendar/events-calendar.module.css:22-58` (`.event`, `.top`, `.time`, `.title`, `.location`)
- Test: `src/client/widgets/events-calendar/events-calendar.test.tsx` (add imports and one case; keep existing cases)

**Interfaces:**
- Consumes: `CalendarEvent` (`startISO`, `endISO`, `title`, `location`, `allDay`), `timeRange(ev)`, `styles.event/.time/.title/.location`.
- Produces: `.event` as a two-column grid; `.time`, `.title`, `.location` as its direct children in grid columns 1, 2, 2; the `.top` class is removed from both JSX and CSS.

- [ ] **Step 1: Write the failing component test**

At the top of `src/client/widgets/events-calendar/events-calendar.test.tsx`, add `import { readFileSync } from "node:fs";` and `import styles from "./events-calendar.module.css";`. Then add this case inside the existing `describe`:

```ts
it("places time and title in two grid tracks with the location under the title", () => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	const { container } = render(
		<EventsCalendar config={{ type: "events-calendar" }} data={{ events: EVENTS }} />,
	);
	const event = container.querySelector(`.${styles.event}`) as HTMLElement;

	expect(event.querySelector(`.${styles.time}`)?.textContent).toContain("14:00");
	expect(event.querySelector(`.${styles.title}`)?.textContent).toBe("Standup");
	expect(event.querySelector(`.${styles.location}`)?.textContent).toBe("Room 4");

	const css = readFileSync(
		"src/client/widgets/events-calendar/events-calendar.module.css",
		"utf8",
	);
	expect(css).toMatch(
		/\.event\s*\{[^}]*grid-template-columns:\s*minmax\(84px,\s*auto\)\s+minmax\(0,\s*1fr\)/,
	);
	expect(css).not.toMatch(/padding-left:\s*92px/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/widgets/events-calendar/events-calendar.test.tsx`
Expected: FAIL — `.location` is not a direct child of `.event`, and the source has no grid declaration and still contains `padding-left: 92px`.

- [ ] **Step 3: Flatten the event chip markup in `src/client/widgets/events-calendar/index.tsx`**

Replace the inner `.top` wrapper so each event renders exactly:

```tsx
<div key={`${ev.startISO}-${ev.title}`} className={styles.event}>
	<span className={styles.time}>{timeRange(ev)}</span>
	<span className={styles.title}>{ev.title}</span>
	{ev.location ? <div className={styles.location}>{ev.location}</div> : null}
</div>
```

Keep the surrounding `<section>`, `dayHeader`, key, and conditional location exactly as they are; only the `.top` wrapper disappears.

- [ ] **Step 4: Rewrite the layout rules in `events-calendar.module.css`**

Replace the `.event` / `.top` / `.time` / `.title` / `.location` blocks with:

```css
.event {
	display: grid;
	grid-template-columns: minmax(84px, auto) minmax(0, 1fr);
	column-gap: 8px;
	row-gap: 1px;
	padding: 6px 8px;
	border-radius: 6px;
}

.time {
	grid-column: 1;
	grid-row: 1;
	font-size: var(--font-size-xs);
	color: var(--color-text-base-muted);
	white-space: nowrap;
}

.title {
	grid-column: 2;
	grid-row: 1;
	font-size: var(--font-size-base);
	color: var(--color-text-highlight);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.location {
	grid-column: 2;
	grid-row: 2;
	font-size: var(--font-size-xs);
	color: var(--color-text-base-muted);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
```

Delete the `.top` rule entirely, drop `.time`'s old `min-width: 84px` (the track now owns that floor), and drop `.location`'s old `padding-left: 92px`. Leave `.events`, `.dayHeader`, and `.empty` as they are. Do not add hex colours or new CSS classes.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/client/widgets/events-calendar/events-calendar.test.tsx`
Expected: PASS — the new grid case plus the existing grouping/All day/empty-state cases.


