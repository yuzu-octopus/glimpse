# Plan 002: Reject mixed `span`+`size` columns at config load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/server/config.ts src/server/config.test.ts scripts/check-config.ts scripts/check-config.test.ts`
> If any of these changed since this plan was written, compare the
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

Today a page whose columns mix `span:` and `size:` passes `check-config`
and server load, then renders 1-track columns with no error anywhere. The
chain: server `validateColumns` skips the size checks for any page where
every column declares `span` — and, fatally, for a MIXED page it runs the
size checks against a config that also has spans, which `resolveSpan` then
rejects by throwing; both client call sites (`inferredColumnSpans`,
`collagePlacement`, skeleton path) catch that throw and fall back to
`?? 1` / `undefined`. So an invalid config renders as three 1-wide columns
instead of failing loudly at load. A config error that reaches the screen
as a broken layout costs the user a debugging session against a config the
tool already accepted. The fix is one validation rule at load: all-span or
no-span per page.

## Current state

- `src/server/config.ts` — `loadConfig` at ~lines 269-294. The facts:
  - `validateColumns(interpolated.pages, errors)` at :280 runs BEFORE the
    zod parse at :285 and pushes text errors that flow through
    `loadConfig → { ok: false, errors }` into the server's 400 and
    `check-config`'s output. That is the ONLY insertion point: `PageSchema`
    in `src/shared/config.ts` refines each column individually (`size` OR
    `span`) and never sees the page, and `resolveSpan` throws for mixed
    pages — which is correct for the renderer, but throwing is not a load
    error.
  - Current `validateColumns` at :153-168: for each page with a columns
    array, if every column has a numeric `span` it returns (explicit-span
    pages skip size rules — correct, they are out of scope here). Otherwise
    it checks `full` counts (≥1, ≤2). For a MIXED page (some span, some
    size), it runs the size checks and passes them — no span error — and
    load succeeds. That is the gap.
  - Error string style: `pages[${pi}]: must have at least one full column`
    (same file, :162). Reuse the `pages[${pi}]:` prefix.
- `scripts/check-config.ts` —maps known messages to hints (`"column
  requires"` → hint at :59). It does NOT need changes unless the new message
  keys off an existing hint pattern — check it, but plan for no edit.
- `src/shared/config.ts` `resolveSpan` at :22-25 throws `"mix of explicit
  span and size not allowed"` — the runtime guard that must keep throwing
  for renderer safety. Do NOT move the check into the shared schema: the
  shared schema validates shape, the server validates a loadable config, and
  the client's try/catch fallbacks must stay as the last line of defense.
- Conventions: server tests per widget/test file use fixtures + fake fetch.
  The config test file is `src/server/config.test.ts` (write the new test
  there). The existing tests there build temp config files — follow that
  pattern, do not invent a new harness.
- Docs: `config.example.yml` documents `span` usage; `README.md` documents
  shared props. Neither changes — this only turns a silent misrender into
  a load error.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Config tests | `bun run test src/server/config.test.ts` | all pass, including 2 new tests |
| Typecheck | `bun check` | exit 0, "No type errors" |
| Lint touched | `biome lint src/server/config.ts src/server/config.test.ts` | exit 0 |
| Format touched | `bun fmt src/server/config.ts src/server/config.test.ts` | exit 0 |
| CLI check | `echo '<mixed page yaml>' > /tmp/mix.yml && bun scripts/check-config.ts /tmp/mix.yml` | exits non-zero, names the mixed page |

## Scope

**In scope** (the only files you should modify):
- `src/server/config.ts` — extend `validateColumns` only.
- `src/server/config.test.ts` — two new tests (mixed rejected, all-span still loads).

**Out of scope** (do NOT touch, even though they look related):
- `src/shared/config.ts` (`ColumnSchema`, `resolveSpan`) — shape validation and the renderer throw stay exactly as they are.
- `src/client/pages/PageView.tsx` (`inferredColumnSpans`, `collagePlacement`, `?? 1` fallbacks) — last-line-of-defense rendering; do not remove the try/catch.
- `scripts/check-config.ts` — read it to confirm the new message needs no hint mapping, but do not edit unless a hint key collides (unlikely; the message is new).
- Any widget fetcher, payload, or tiling code.

## Git workflow

- Branch: `advisor/002-mixed-span-rejection`
- One commit; message style: `fix(config): reject mixed span+size columns at load`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend `validateColumns` to reject mixed pages

In `src/server/config.ts`, inside `validateColumns`'s per-page loop, before
the `usesExplicitSpan` early return, compute whether SOME (but not every)
column declares a numeric `span`:

```ts
const cols = page.columns as unknown[];
const hasSpan = (c: unknown): boolean => isRecord(c) && typeof c.span === "number";
if (cols.some(hasSpan) && !cols.every(hasSpan)) {
	errors.push(
		`pages[${pi}]: mix of explicit span and size not allowed — give every column a span, or none`,
	);
	return;
}
```

Match the existing message voice (prefix `pages[${pi}]:`, imperative, names
the fix). Place it BEFORE the `usesExplicitSpan` return so the three states
read: all-span → skip size rules; mixed → error; no-span → size rules.
A mixed page must NOT also collect size-rule errors — `return` right after
pushing, because the size checks are meaningless once spans are present.

**Verify**: `bun check` → clean. `biome lint src/server/config.ts` → clean.

### Step 2: Cover both states in the config test

In `src/server/config.test.ts`, following the file's existing temp-config
pattern, add:

1. A page with columns `[{span: 6, ...}, {size: "full", ...}]` fails to load
   and the errors array contains the mixed message.
2. A page with all-`span` columns (`[{span: 6}, {span: 6}]`, no sizes) loads
   successfully — pinning that the new rule does not touch the explicit-span
   path, which the size rules deliberately skip.

**Verify**: `bun run test src/server/config.test.ts` → all pass including the two new tests.

### Step 3: Confirm the CLI surfaces it

Write a minimal mixed `pages:` YAML to `/tmp/mix-check.yml` and run
`bun scripts/check-config.ts /tmp/mix-check.yml`. Expect a non-zero exit
and the `pages[0]: mix of explicit span…` message in the output. Delete
`/tmp/mix-check.yml` afterwards — it must not enter the repo.

**Verify**: message appears; exit code non-zero; check `git status` shows no `/tmp` file tracked (it can't be — but confirm no stray fixture landed in `src/`).

### Step 4: Format only the touched files

**Verify**: `bun fmt src/server/config.ts src/server/config.test.ts` → exit 0. `git status` shows only those two files.

## Test plan

- New tests in `src/server/config.test.ts`: mixed-span page rejected with the
  exact message; all-span page still loads. Model them on the existing temp-file
  config tests in that file.
- No other new tests. Full config suite must stay green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test src/server/config.test.ts` exits 0, including exactly two new tests that fail when Step 1 is reverted (verify by stashing the source change only and re-running).
- [ ] `bun check` exits 0.
- [ ] `biome lint src/server/config.ts src/server/config.test.ts` exits 0.
- [ ] `bun scripts/check-config.ts` on a mixed-span fixture exits non-zero and prints the mixed message.
- [ ] `git status` shows only `src/server/config.ts` and `src/server/config.test.ts` modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `validateColumns` code or `loadConfig` error flow doesn't match the "Current state" excerpts.
- `scripts/check-config.ts` swallows or rewrites the new message in a way the CLI demo in Step 3 exposes — report the interaction, don't redesign the CLI.
- Any existing config test breaks: that means a fixture legitimately mixes span and size, and the fixture — not this plan — needs adjudication by the maintainer.
- The fix appears to require touching `src/shared/config.ts` or `PageView.tsx` — scope is load-time rejection only.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The three-state rule in `validateColumns` (all-span / mixed / no-span) must stay in sync with the client fallbacks: if a fourth column-sizing mode ever appears, both the load rejection and the `?? 1` renderer fallback need it.
- `resolveSpan`'s throw is still the renderer's guard — never convert it into a silent fallback widening, or invalid configs will misrender again.
- Watch `check-config`'s hint map: if a future message accidentally matches the new wording, the CLI will attach a wrong hint.
