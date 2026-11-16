# Plan 004: Single TTL table for server cache and client polling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/shared/live.ts src/server/cache.ts src/client/hooks/usePageData.ts vite.config.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

Two widgets tune TTLs in a place the poller cannot see. `getDefaultTtl` in
`src/server/cache.ts` gives `model-releases` 60s and `weather-radar` 600s,
but `LIVE_TYPES` in `src/shared/live.ts` lists neither — so `getLiveKey` in
`usePageData.ts` returns `none` and installs no interval for them. The 60s /
600s values still matter (focus and route revalidation re-fetch against the
cache), so nothing is "dead" — but the tuning lives in the wrong layer: a
future editor who changes the radar TTL in `cache.ts` cannot tell from the
code that no poll will ever observe it, and the `vite.config.ts` TTL table
documents only the three tiers. One table, keyed by type, removes the
ambiguity: every per-type exception is visible next to the poll membership
that does or does not consume it.

## Current state

- `src/shared/live.ts` — the contract both sides already import. Current
  content (verify exactly):

```ts
export const LIVE_TYPES: Record<string, true> = { clock, weather, markets, monitor, server-stats, system-stats (all: true) };
export const LIVE_POLL_MS = 30_000;
export const LIVE_TTL_MS = 60_000;
export const STATIC_TTL_MS = 3_600_000;
```

- `src/server/cache.ts:60-65` — `getDefaultTtl` with two per-type
  overrides (`weather-radar → 600_000` with a RainViewer-frame comment;
  `model-releases → 60_000`) falling through to
  `LIVE_TYPES[type] ? LIVE_TTL_MS : STATIC_TTL_MS`.
- `src/client/hooks/usePageData.ts:37-52` — `getLiveKey` returns `"none" |
  "live" | "homelab"`; `live` polls at `LIVE_POLL_MS` (30s), `homelab` at
  1s. `model-releases`/`weather-radar` map to `none` today.
- `vite.config.ts:43-51` — the TTL tier comment table. It lists three tiers
  and must gain the two exceptions (with the same numbers as code).
- Polling tiers (`homelab` 1s for server-stats/system-stats, `live` 30s for
  the rest) are load-bearing and covered by tests — this plan does not
  change any interval, any TTL value, or any poll membership. It moves
  where the values are declared, nothing else.

Conventions: `src/shared/` is a leaf (no runtime server/client imports);
Zod not involved; `bun check` + `biome lint` + existing hook tests are the
verification.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint touched | `biome lint src/shared/live.ts src/server/cache.ts src/client/hooks/usePageData.ts vite.config.ts` | exit 0 (vite.config.ts may be out of lint scope — confirm, don't force) |
| Hook tests | `bun run test src/client/hooks/usePageData.test.tsx` | all pass |
| Server tests | `bun run test src/server/api.test.ts` | all pass (TTL-adjacent coverage) |
| Format | `bun fmt <touched files>` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/shared/live.ts` — add the per-type table.
- `src/server/cache.ts` — `getDefaultTtl` reads it.
- `src/client/hooks/usePageData.ts` — `getLiveKey` reads it (mapping unchanged: today’s live set stays live, today’s static set stays static).
- `vite.config.ts` — comment table gains the two exception rows.

**Out of scope** (do NOT touch):
- Any TTL VALUE, any poll interval, any poll membership (`model-releases` and `weather-radar` stay unpolled — this plan documents that, it does not change it).
- `src/server/runtime.ts`, warmup, streaming, or cache invalidation paths.
- Adding new types to `LIVE_TYPES` or changing `LIVE_POLL_MS`.

## Git workflow

- Branch: `advisor/004-single-ttl-table`
- One commit; message style: `refactor: single TTL table for server cache and client polling`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the per-type table to shared/live.ts

Declare, next to `LIVE_TYPES`, a per-type override map with the SAME two
entries and comments that currently live in `getDefaultTtl`:

```ts
export const TTL_OVERRIDE_MS: Record<string, number> = {
  // RainViewer publishes new frames every ~10min — no point polling faster.
  "weather-radar": 600_000,
  "model-releases": 60_000,
};
```

Keep the existing `LIVE_TYPES` / `LIVE_POLL_MS` / `LIVE_TTL_MS` /
`STATIC_TTL_MS` untouched — the poll side reads the same names it does
today.

**Verify**: `bun check` → clean.

### Step 2: Read it from getDefaultTtl

In `src/server/cache.ts`, replace the two hard-coded branches with a lookup
into the shared table, falling through to the existing live/static line.
Keep the RainViewer comment WITH the table entry in `live.ts` (Step 1),
not duplicated in `cache.ts`.

**Verify**: `bun check` → clean. `bun run test src/server/api.test.ts` → pass.

### Step 3: Read it from getLiveKey (mapping unchanged)

In `src/client/hooks/usePageData.ts`, keep the exact same return values for
every type (`none` for the two exceptions — they stay unpolled), but derive
the live/static branch from the shared table instead of a local list, so a
future type added in one place is visible in both. Do NOT add either type to
the polled set; do NOT change `LIVE_POLL_MS` handling.

**Verify**: `bun run test src/client/hooks/usePageData.test.tsx` → pass.

### Step 4: Update the vite.config.ts TTL table comment

Add the two exception rows to the comment block at `vite.config.ts:43-51`
with the exact numbers from code (60s model-releases, 10m weather-radar)
plus one line noting both are unpolled (focus/route revalidation only).
Comment-only change.

**Verify**: `bun fmt vite.config.ts` → exit 0 (or confirm the file is out of
fmt scope and leave it — check `bun fmt --check` verdict, don't reformat
by hand).

## Test plan

- No new tests: behavior is explicitly unchanged (same values, same
  memberships). Existing suites are the verification: `usePageData.test.tsx`
  (polling), `api.test.ts` (payload/TTL-adjacent).
- The `git diff` itself is the review artifact: it must show pure
  declaration moves plus two comment rows, no value changes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "600_000\|60_000" src/server/cache.ts` returns no hits (values live only in `shared/live.ts`).
- [ ] `bun run test src/client/hooks/usePageData.test.tsx src/server/api.test.ts` exits 0.
- [ ] `bun check` exits 0.
- [ ] `biome lint` on the touched files exits 0.
- [ ] `git status` shows only the four in-scope files.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The live `LIVE_TYPES`, `getDefaultTtl`, or `getLiveKey` don't match the "Current state" excerpts.
- Any test asserts the CURRENT declaration site (e.g. a test importing `getDefaultTtl` internals) — report the coupling, don't redesign the test.
- Making `getLiveKey` read the shared table would change any type's poll tier — that means the mapping drifted from "unchanged"; stop, do not "fix" it by re-tiering.
- The change requires touching `runtime.ts`, warmup, or the NDJSON protocol.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The rule going forward: per-type TTL exceptions live ONLY in `shared/live.ts`. A future `bun run lint` won't catch a stray hard-coded TTL in `cache.ts` — reviewers must.
- If `model-releases` or `weather-radar` ever needs polling, add it to the live map in the same file, not in the hook — the table is now the single place both sides read.
- The vite comment table is documentation, not code — update it in the same commit as any future TTL change (the plan template's Done criteria enforce this by listing the file).
