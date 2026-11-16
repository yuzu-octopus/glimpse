# Plan 008: Align docs with the shipped toolchain and pin it with a derivation test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- AGENTS.md README.md package.json vite.config.ts src/server/cache.ts src/shared/live.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

The repo shipped a new toolchain (deps to latest, `bun check`, `bun fmt`,
pinned `biome lint`) but the docs still describe the old one: `AGENTS.md`
and `README.md` prescribe `bunx tsc --noEmit` and `biome check src
scripts`, both cite `astryx-dracula@0.5.1` while `package.json` installs
`^0.6.2`, and the `vite.config.ts` TTL table omits the per-type exceptions
`cache.ts` implements. Every one of these is worse than a missing doc: a
contributor following them gets a different toolchain, a different theme,
and a different mental model of TTLs than the code ships. Fix all of them
in one pass, then add the derivation test that makes this class of drift
fail loudly next time.

## Current state

Facts, verified against the tree (not assumed):

- `package.json`: `astryx-dracula ^0.6.2`, `@astryxdesign/core ^0.7.2`,
  scripts `build: bun check && vite build`, `typecheck: bun check`,
  `lint: biome lint`, `fmt`/`fmt:check: bun fmt '**/*.{ts,tsx,mjs,js,jsx,json,css}'`.
- `AGENTS.md:41` build line says `tsc --noEmit && vite build`; `:61`
  cites `astryx-dracula ^0.5.1`; `:80` cites `astryx-dracula@0.5.1`;
  `:93` gates say ``bunx tsc --noEmit` clean` and `biome check src scripts
  zero errors (global fallback config...)`; `:94` says run
  `bunx tsc --noEmit` before commit.
- `README.md:211` Development section says `bunx tsc --noEmit # strict
  typecheck gate`; `:154` cites the kit at `^0.5.1`.
- `vite.config.ts:43-51` TTL table lists three tiers; `src/server/cache.ts:
  60-65` implements two per-type exceptions (weather-radar 600s with the
  RainViewer comment, model-releases 60s) that the table omits.
- Conventions: AGENTS.md is the authority on repo layout (this file's
  edits must match its voice — terse, contract-style); README is the
  user-facing authority; `src/shared/theme/` holds one token-contract test
  — check how it asserts and follow that pattern for the new derivation
  test (Step 2).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint touched | `biome lint <touched docs-adjacent files>` | exit 0 (md not linted — confirm scope, don't force) |
| New test | `bun run test <new test path>` | all pass |
| Full suite | `bun run test` | only the 4 known pre-existing failures |
| Format | `bun fmt <touched code files>` | exit 0 (docs .md are out of fmt scope — same as the repo's fmt glob) |

## Scope

**In scope** (the only files you should modify):
- `AGENTS.md` — toolchain lines only (`:41`, `:61`, `:80`, `:93`, `:94`).
- `README.md` — kit version pin (`:154`) and typecheck gate (`:211`).
- `vite.config.ts` — TTL comment table only (add the two exception rows).
- ONE new derivation test file (location per the token-contract test pattern you find in `src/shared/theme/`).

**Out of scope** (do NOT touch):
- Any code behavior, any TTL value, any poll membership (plan 004 owns the TTL consolidation; this plan only documents current values — if 004 lands first, quote its table).
- `package.json`, `bunfig.toml`, `biome.json` (the toolchain itself is settled).
- Any other docs section, `docs/research/*`, `CHANGELOG.md` (the release process owns that).

## Git workflow

- Branch: `advisor/008-toolchain-docs-drift-test`
- One commit; message style: `docs: align toolchain pins with shipped versions, add TTL drift test`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update the toolchain lines in AGENTS.md

- `:41` build line: `bun check && vite build` (match package.json exactly).
- `:93` gates: `` `bun check` clean · `bun run test` green · `biome lint` zero diagnostics (repo `biome.json`, formatter off — bun fmt owns bytes) · `bunx react-doctor@latest` full scan ``.
- `:94` run line: `bun check` before commit.
- `:61` and `:80`: `astryx-dracula` `^0.6.2` / `astryx-dracula@0.6.2` (match package.json exactly — copy the string, don't retype).
- Keep the surrounding voice (terse contract bullets). Do not renumber, rewrap, or "improve" adjacent lines.

**Verify**: `grep -n "tsc --noEmit\|0\.5\.1\|biome check" AGENTS.md` returns no hits.

### Step 2: Update README pins

- `:154`: kit version to `^0.6.2` (match package.json).
- `:211`: `bun check   # strict typecheck gate` (match the `typecheck` script name and command; keep the one-line comment style).

**Verify**: `grep -n "tsc --noEmit\|0\.5\.1" README.md` returns no hits.

### Step 3: Add the TTL exception rows to the vite table

In the `vite.config.ts:43-51` comment, add two rows with the exact numbers
from `cache.ts` (weather-radar 600s + RainViewer rationale, model-releases
60s), each marked unpolled (focus/route revalidation only). If plan 004 has
landed, quote ITS table location instead of duplicating — check for
`TTL_OVERRIDE_MS` first and cross-reference rather than fork. Comment-only
change.

**Verify**: values match `cache.ts` (or `live.ts` post-004) exactly.

### Step 4: Add the derivation test

Following the `src/shared/theme/` token-contract test pattern (read it
first — same assertion style, same file placement conventions):

- The test reads the three sources of truth at test time: `package.json`
  (kit version range), `AGENTS.md` + `README.md` (pinned strings), and
  `vite.config.ts` (TTL table) vs `src/server/cache.ts` (`getDefaultTtl`
  — or `src/shared/live.ts` post-004).
- It asserts: (a) the kit version pinned in both docs equals the
  `package.json` range; (b) the TTL comment table contains every per-type
  exception the code implements (parse the numbers, compare).
- It must FAIL today if you revert any Step 1–3 edit (verify by reverting
  one line and re-running — that's the derivation proof).

Name and location: follow the token-contract test's lead (likely
`src/shared/theme/toolchain-contract.test.ts` or alongside it — read that
directory first; if it dictates a different home, follow it and note the
deviation in the commit message).

**Verify**: `bun run test <new test>` → pass; revert-one-line check → fail; restore → pass.

### Step 5: Format only the touched code files

**Verify**: `bun fmt` on touched code files → exit 0 (docs .md are out of
fmt scope — confirm `bun fmt --check` verdict, don't hand-format). `git
status` shows only the in-scope files.

## Test plan

- New derivation test (Step 4): doc pins == package.json range; TTL table rows == code exceptions. Must fail on revert of any covered line.
- Full suite must show no NEW failures (4 pre-existing baseline failures stay).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "tsc --noEmit\|biome check src scripts\|0\.5\.1" AGENTS.md README.md` returns no hits.
- [ ] New derivation test passes, and fails when any single covered doc line is reverted.
- [ ] `bun run test` shows no failures beyond the 4 known pre-existing ones.
- [ ] `bun check` exits 0; `biome lint` on touched code files exits 0.
- [ ] `git status` shows only the in-scope files.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The doc lines or code values don't match the "Current state" excerpts (plan 004 may have landed and moved the TTL table — reconcile first, don't duplicate it).
- The token-contract test pattern can't be followed (different harness, different location conventions) — report the actual pattern, don't invent a new test style.
- Any Step 1–3 edit requires changing code behavior to make the docs true (docs follow code, never the reverse — if a doc line contradicts working code, the doc is wrong).
- The derivation test needs network, filesystem writes outside the repo, or generated files.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The derivation test is the mechanism that keeps docs honest — every future dep bump or TTL change must update the doc line in the same commit, or this test fails. Say that in the commit message.
- If the TTL table moves (plan 004), the test's parse target moves with it — one place, not two; the test file header must name where the table lives.
- `bunx tsc --noEmit` and `biome check src scripts` are dead commands in this repo now — if they reappear in docs, the test should catch the version pins but NOT the command strings; extend it if command drift recurs.
