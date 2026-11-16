# Hidden-tab polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the page-data polling interval from issuing network requests while the browser tab is hidden.

**Architecture:** `usePageData` already revalidates on focus, online, controllerchange and `visibilitychange` when the cache is stale. The polling interval itself has no visibility guard, so a hidden lab page rebuilds and streams a payload every second. Add a single `document.hidden` early return in the interval callback; the existing visibility handler remains responsible for the one revalidation when the tab becomes visible again.

**Tech Stack:** Bun 1.4.4, React 19, Vitest with fake timers, `@testing-library/react`.

**Spec:** `/tmp/mobile-findings.md` — finding M07 and "Global constraints for every plan".

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- The visibility handler (`onVisible`) is the only return-to-tab revalidation; the guard must not suppress it.
- Every task ends with a checkable test/command; implementers do **not** run formatters or repo-wide gates — the orchestrator runs them once per wave.
- One atomic commit per completed plan; commit message names the plan file. No push.
- Wave gates (orchestrator only): `bun check`; `biome lint <each edited TS/TSX file>`; `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`.
- Per-task test command: `bun run test src/client/hooks/usePageData.test.tsx`.

## Review Focus

- **Hidden homelab tab (1s cadence):** no `/api/page/` request for any number of elapsed seconds. Pinned by Task 1 step 1.
- **Return to a hidden-then-stale tab:** exactly one revalidation on `visibilitychange`, not one per missed tick. Pinned by Task 1 step 1.
- **Explicit actions while hidden:** only the interval is guarded; `reload()`/`validate()` still work when called by the UI. Pinned by Task 1 step 5.
- **Pages with no live widgets:** no interval is created at all; the guard is unreachable there and no behaviour changes. Pinned by Task 1 step 6 (existing full test file stays green).

---

### Task 1: Guard the polling interval and prove the return path

**Files:**
- Modify: `src/client/hooks/usePageData.ts` (interval callback at lines 628-635)
- Test: `src/client/hooks/usePageData.test.tsx`

**Interfaces:**
- Consumes: `usePageData(slug)`, `__clearCacheForTests()`, `makePayload()`, `ndjsonResponse()` and the `beforeEach`/`afterEach` setup already in the test file.
- Produces: no new exports; the observable contract is "interval ticks do not fetch while `document.hidden` is true".

- [ ] **Step 1: Write the failing hidden-tab test**

Add to `src/client/hooks/usePageData.test.tsx` (imports `renderHook`; add `waitFor` to the existing `@testing-library/react` import):

```tsx
it("does not poll a hidden tab and revalidates once on return", async () => {
	let hidden = true;
	const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
	const stateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
	Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => (hidden ? "hidden" : "visible"),
	});
	const payload = makePayload({
		columns: [{
			size: "full",
			widgets: [{
				type: "server-stats" as WidgetType,
				config: { type: "server-stats" },
				data: { servers: [] },
			}],
		}],
	});
	const fetchMock = vi.fn(async () => ndjsonResponse([{ path: "$skeleton", payload }]));
	vi.stubGlobal("fetch", fetchMock);

	vi.useFakeTimers();
	const view = renderHook(() => usePageData("home"));
	vi.useRealTimers();
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	const afterMount = fetchMock.mock.calls.length;

	vi.useFakeTimers();
	await act(async () => {
		// 31s > STALE_MS, so the return path is eligible to revalidate;
		// the homelab interval would otherwise have fired 31 times.
		await vi.advanceTimersByTimeAsync(31_000);
	});
	expect(fetchMock).toHaveBeenCalledTimes(afterMount);

	hidden = false;
	await act(async () => {
		document.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(10);
	});
	expect(fetchMock).toHaveBeenCalledTimes(afterMount + 1);
	expect(view.result.current.error).toBeNull();

	vi.useRealTimers();
	if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
	if (stateDescriptor) Object.defineProperty(document, "visibilityState", stateDescriptor);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: FAIL — `fetchMock` was called far more than `afterMount` times after the timer advance.

- [ ] **Step 3: Add the guard**

In `src/client/hooks/usePageData.ts`, make the interval callback (currently lines 631-633) start with the visibility check:

```ts
const id = window.setInterval(() => {
	if (document.hidden) return;
	void validate();
}, interval);
```

Leave `onVisible`, `isStale`, `LIVE_POLL_MS` and the `liveKey` selection untouched.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: PASS (one mount fetch, zero hidden-tick fetches, one fetch after `visibilitychange`).

- [ ] **Step 5: Pin that explicit reload is unaffected**

Extend the test: with `hidden` set back to `true`, call `await act(async () => { await view.result.current.reload(); });` under real timers and assert `fetchMock` was called once more. This proves the guard sits in the interval only.

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify the whole file and commit**

Run: `bun run test src/client/hooks/usePageData.test.tsx`
Expected: PASS, including the existing render-skip dedupe and stream-reconciliation tests.

