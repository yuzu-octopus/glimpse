# Task 4 Report: Delayed Page Skeleton (250ms)

**Status:** Done  
**Commit:** 45dc8f0 `feat: delay page skeleton 250ms to avoid flash on fast loads`  
**Tests:** `bunx vitest run src/client/pages` — 56 passed (4 files) — includes new `does not render skeleton before 250ms` + 2 updated existing skeleton tests

## What changed
- `src/client/pages/PageView.tsx`: Added `DelayedSkeleton` local component (`useState`+`useEffect` with `window.setTimeout(250)`, cleanup on unmount) exactly per brief. Wrapped `if (page) return <PageSkeleton>` with `<DelayedSkeleton><PageSkeleton/></DelayedSkeleton>`. Fallback `page-loading` path (no `page` prop) left immediate — only config-driven skeleton delayed per NNG <1s rule.
- `src/client/pages/PageView.test.tsx`: Added `act` import. Updated 2 existing skeleton tests to use `vi.useFakeTimers` + pending fetch + `advanceTimersByTime(260)` before asserting `page-skeleton` (otherwise they fail under delay). Added new `does not render skeleton before 250ms` test mirroring brief: `queryByTestId` null before 250ms, truthy after 260ms, restores real timers.

## Self-review
- Correctness: DelayedSkeleton matches brief verbatim; delay default 250, prop override supported, timer cleared on unmount. Unconditional hooks (top-level inside component, no conditional useEffect).
- Existing tests: `renders per-widget skeleton cards ... then fills` now uses `Promise.withResolvers` deferred fetch to allow skeleton visibility before data arrival; advances 260ms, verifies skeleton, then resolves fetch and verifies widget fill. `emits estimated row spans` similarly delayed. Both now pass; direct `<PageSkeleton>` tests unaffected.
- Timer hygiene: every `useFakeTimers` paired with `useRealTimers` + `unstubAllGlobals`; uses `act` wrapper for timer advance.

## Fix Round 1 (d79a766)
- `afterEach` now calls `vi.useRealTimers()` so leaked fake timers on assertion failure cannot pollute subsequent tests; per-test manual `useRealTimers`/`unstubAllGlobals` at test tails removed (now covered by afterEach).
- New test `does not render skeleton before 250ms`: `toBeTruthy()` → `toBeInTheDocument()` to match existing style (getBy already throws).
- `renders per-widget skeleton ... then fills`: retains mid-test `vi.useRealTimers()` before deferred fetch resolution (required for `waitFor` polling); afterEach acts as safety net, making the switch non-fragile.

## Concerns
- None blocking. Same pending-promise note as above.
