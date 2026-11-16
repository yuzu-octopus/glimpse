# Plan 001: Copy-on-write stream reconciliation in `applyChunk`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/client/hooks/usePageData.ts src/client/hooks/usePageData.test.tsx`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

The streaming invariant is the load-bearing correctness claim of the client:
memoized columns skip re-render because a payload update arrives as new array
refs (AGENTS.md "Memo invariants"). But `applyChunk` mutates the *input*
payload's nested arrays in place for the column and headWidgets paths, then
emits the same array refs. Previously emitted snapshots alias those arrays, so
an in-flight subscriber holding an old snapshot sees it change under it, the
`widgetKeysCache` WeakMap (keyed on array identity) goes stale, and memoized
columns can miss updates or render torn mid-stream frames. The flat
`widgets[]` path already does the right thing (slice before assignment); the
column and head paths must match it. This plan fixes only the mutation; it
changes no stream shape, no payload, no cache behaviour.

## Current state

- `src/client/hooks/usePageData.ts` — SWR + NDJSON streaming hook. The only
  file that changes.
- `applyChunk(base, path, payload)` at ~lines 131-152 (exact text below).
  It mutates `base.columns[ci].widgets[wi]` and `base.headWidgets[i]` in place.
  Note `base` here is `cachedBase`, a `structuredClone` of the cache — so the
  cache itself is safe — but `base` is ALSO the object handed to every
  previous `emit` subscriber as `{ ...base }` (a shallow copy that shares the
  same nested arrays). Every chunk therefore mutates arrays the last render
  already holds.
- `widgetKeysCache` at `src/client/pages/PageView.tsx:88-94` keys on the
  widget *array* identity (`new WeakMap<WidgetLike[], string[]>`), so a
  mutated-but-identical array ref returns stale keys. That is the exact
  invariant the header comment at usePageData.ts:184-188 claims holds.

Current code (verify these exact lines before editing):

```ts
// src/client/hooks/usePageData.ts:131-152
function applyChunk(base: PagePayload, path: string, payload: unknown): void {
	const w = payload as WidgetPayload;
	let m = /^columns\[(\d+)\]\.widgets\[(\d+)\]$/.exec(path);
	if (m) {
		const col = base.columns[Number(m[1])];
		if (col?.widgets[Number(m[2])]) col.widgets[Number(m[2])] = w;
		return;
	}
	m = /^headWidgets\[(\d+)\]$/.exec(path);
	if (m) {
		if (base.headWidgets[Number(m[1])]) base.headWidgets[Number(m[1])] = w;
		return;
	}
	m = /^widgets\[(\d+)\]$/.exec(path);
	if (m && base.widgets) {
		const idx = Number(m[1]);
		if (base.widgets[idx]) {
			base.widgets = base.widgets.slice();
			base.widgets[idx] = w;
		}
	}
}
```

Repo conventions to match (read the exemplar first):
- Unconditional hooks, no inline casts, strict TS with `noUnusedLocals`.
  Follow the existing `flat` path's `slice()` style — do not introduce a
  deep-clone utility or an immer-style helper.
- Tests live beside the module: `src/client/hooks/usePageData.test.tsx`
  uses `vi.stubGlobal("fetch")`, `vi.resetModules()` + dynamic import, and
  `__clearCacheForTests()` between tests. Model the new regression test on
  the existing hook tests there.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Lint file | `biome lint src/client/hooks/usePageData.ts` | exit 0, no diagnostics |
| Typecheck | `bun check`              | exit 0, "No type errors" |
| Hook tests| `bun run test src/client/hooks/usePageData.test.tsx` | all pass |
| Format    | `bun fmt src/client/hooks/usePageData.ts src/client/hooks/usePageData.test.tsx` | exit 0 |

## Suggested executor toolkit

- `skill://systematic-debugging` if a test you add fails against the current code — that is the bug reproducing, not a reason to weaken the test.

## Scope

**In scope** (the only files you should modify):
- `src/client/hooks/usePageData.ts` — the two mutating branches of `applyChunk` only.
- `src/client/hooks/usePageData.test.tsx` — one new regression test.

**Out of scope** (do NOT touch, even though they look related):
- `src/client/pages/PageView.tsx` — the key cache and memo slots are consumers, not the bug.
- `src/server/api.ts`, `src/server/cache.ts` — server streaming/caching are correct; the mutation is client-side.
- `reconcileWithCached` / `reconcileStreamEnd` — they also mutate, but they run on `skeleton` (fresh from the stream) and `structuredClone`d cache, never on an emitted snapshot. Out of scope; do not "fix" them as drive-bys.
- Any change to payload shape, stream protocol, or cache keys.

## Git workflow

- Branch: `advisor/001-copy-on-write`
- One commit; message style matches repo (`git log --oneline -5`): lowercase, imperative, scope in parentheses, e.g. `fix(client): copy-on-write stream chunk reconciliation`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the regression test first (TDD — watch it fail)

Add a test to `src/client/hooks/usePageData.test.tsx` that drives two chunks
on the same column and asserts the first emission's data does not change when
the second chunk lands:

- Use the file's existing fixture pattern (`__clearCacheForTests`, stubbed
  `fetch` with an NDJSON body: a `$skeleton` line then two `columns[0].widgets[0]`
  / `columns[0].widgets[1]` chunk lines).
- Capture the payload object from the first `emit` (the hook's progress
  callback or the rendered data ref — follow the existing tests' observation
  point in that file).
- After the second chunk arrives, assert the first snapshot's
  `columns[0].widgets[0]` is still the first chunk's payload (reference and
  value). Today this FAILS: the first snapshot's array was mutated in place.

**Verify**: `bun run test src/client/hooks/usePageData.test.tsx` → the new test fails, all others pass.

### Step 2: Copy-on-write in the two mutating branches

In `applyChunk`, mirror the existing flat-path style:

- Column path: `const col = base.columns[Number(m[1])];` → if the target
  exists, first replace `base.columns` with `base.columns.slice()` AND the
  column with `{ ...col, widgets: col.widgets.slice() }`, then assign the
  chunk into the fresh widgets array. Two slices: the columns array (so its
  ref changes) and the column's widgets (so the widget array ref changes).
- headWidgets path: same shape — `base.headWidgets = base.headWidgets.slice()`
  before assigning into it. There is no intermediate column object here.
- Do NOT touch the flat `widgets[]` path (already correct), the regexes, or
  the function signature (returns `void`, mutates `base` — the emitted
  `{ ...base }` then shares only replaced arrays, which is exactly the
  invariant the file's header comment claims).

**Verify**: `bun run test src/client/hooks/usePageData.test.tsx` → all pass, including the new test. `bun check` → clean. `biome lint src/client/hooks/usePageData.ts` → clean.

### Step 3: Format only the touched files

**Verify**: `bun fmt src/client/hooks/usePageData.ts src/client/hooks/usePageData.test.tsx` → exit 0. Confirm `git status` shows only those two files.

## Test plan

- New regression test (Step 1): two chunks to the same column; first
  snapshot's array and element must be referentially stable and value-stable
  after the second chunk. Pattern: the existing NDJSON-fixture tests in
  `src/client/hooks/usePageData.test.tsx`.
- No other new tests. Existing suite must stay green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test src/client/hooks/usePageData.test.tsx` exits 0, including exactly one new test that fails when Step 2 is reverted (verify by `git stash`ing the source change only and re-running).
- [ ] `bun check` exits 0.
- [ ] `biome lint src/client/hooks/usePageData.ts src/client/hooks/usePageData.test.tsx` exits 0.
- [ ] `git status` shows only `src/client/hooks/usePageData.ts` and `src/client/hooks/usePageData.test.tsx` modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live file (the codebase drifted since `c794221`).
- The new test fails for a reason other than in-place mutation (e.g. the NDJSON fixture format changed) — the fixture pattern, not the assertion, may be wrong.
- Fixing the mutation requires touching `reconcileWithCached`, `emit`, or the server stream format — that means the scouting was wrong about the blast radius.
- More than one test file needs changes — this plan is scoped to one hook and its test.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The rule to carry forward: **a payload object that has been emitted must never be mutated again**. Any future chunk-application path (new path shapes in `streamPagePayload`) must slice before writing, same as the flat path always did.
- `reconcileWithCached` and `reconcileStreamEnd` intentionally mutate `skeleton`/`cachedBase` because neither has been emitted yet; if that changes (e.g. skeleton caching), they need the same treatment.
- The `widgetKeysCache` WeakMap in PageView is why array identity matters, not just values — a future "optimisation" that reuses arrays will reintroduce this bug silently. Review any change to chunk handling for new array refs.
