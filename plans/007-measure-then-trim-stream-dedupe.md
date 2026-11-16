# Plan 007: Measure, then trim, the stream dedupe cost

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

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

Every stream chunk triggers `JSON.stringify(progress)` on the whole page
payload for dedupe, plus a `structuredClone` of the cached page per stream.
On large pages that is serialize-the-world per widget settle, and on 1s
homelab polls it is a per-second tax. BUT the obvious fix — per-path
versions — is WRONG: the file's own comment (lines 510-513) documents that
stream versions reset to 0 on every fetch, so cross-poll versions collide
and a version-only check would swallow genuine changes. This plan therefore
does NOT prescribe a fix. It prescribes a measurement, then the cheapest
correct optimization the measurement justifies — with a hard rollback if
any dedupe test breaks.

## Current state

- `src/client/hooks/usePageData.ts` — the emit closure at ~lines 496-517
  (exact text below). The dedupe is a full-page `JSON.stringify` compared
  against `lastPayloadJsonRef`. The `structuredClone(cached)` at ~line 321
  feeds `reconcileWithCached`.

```ts
// Content is the dedupe identity: the stream version counter resets
// to 0 on every fetch, so versions collide across polls (stream 2's
// v1 === stream 1's v1) and a version-only check would swallow a
// genuinely changed payload.
const json = JSON.stringify(progress);
if (json === lastPayloadJsonRef.current) return false;
```

- `src/client/hooks/usePageData.test.tsx` line ~43 notes the suite "cannot
  measure dedupe" — the stub renders don't exercise the stringify path at
  scale. Any claim of improvement needs a benchmark the repo does not
  currently have; Steps 1-2 build one as a throwaway (NOT committed).
- Conventions: fake-timer NDJSON-fixture hook tests; `bun check`;
  throwaway scripts verified then removed (AGENTS.md).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint touched | `biome lint <touched files>` | exit 0 |
| Hook tests | `bun run test src/client/hooks/usePageData.test.tsx` | all pass |
| Benchmark | `bun /tmp/dedupe-bench.ts` (Step 1) | prints timings, exit 0 |
| Format | `bun fmt <touched files>` | exit 0 |

## Suggested executor toolkit

- `skill://systematic-debugging` if the benchmark contradicts the hypothesis — the measurement wins, not the plan.

## Scope

**In scope** (the only files you may modify):
- `src/client/hooks/usePageData.ts` — the dedupe comparison ONLY, and only if Step 1 justifies it.
- `src/client/hooks/usePageData.test.tsx` — ONE new test pinning the optimized behavior (and only if Step 2 lands a change).

**Out of scope** (do NOT touch, even though they look related):
- `reconcileWithCached` / `structuredClone` (a separate allocation question; this plan is the stringify path only).
- `versionRef` / `versionBySlug` mechanics — versions are explicitly NOT the dedupe identity; do not "fix" them into being one.
- `applyChunk`, `reconcileStreamEnd`, the stream protocol, poll intervals, cache TTLs.
- Committing the benchmark file or any fixture data.

## Git workflow

- Branch: `advisor/007-stream-dedupe-measure`
- One commit, and ONLY if Step 2 lands a change; if the measurement says "not worth it", update the plans index to REJECTED with the numbers and change nothing. Message style if landed: `perf(client): cheaper stream dedupe check`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Benchmark the actual cost (throwaway, /tmp only)

Write `/tmp/dedupe-bench.ts` (NOT in the repo): build a synthetic
PagePayload with N widgets × M bytes of data (start N=30, M=2KB — a
large home page; also try N=100), then time 100 iterations of
`JSON.stringify(payload)` plus a byte-length comparison of the result.
Also time `Bun.hash(payload-json)` as a candidate cheap comparator and a
per-chunk-path hash (hash ONLY the chunk's `payload` + `path`, not the
whole page — the chunk is what changed, and the base is untouched
elsewhere by construction of `applyChunk`... verify that claim against
`applyChunk`'s code before relying on it).

Print: JSON.stringify ms/iter, hash ms/iter, and the ratio. This is the
decision input — no code changes yet.

**Verify**: `bun /tmp/dedupe-bench.ts` prints all three numbers, exit 0.

### Step 2: Land the cheapest CORRECT optimization, or stop

Candidates in order of preference (take the first whose benchmark AND
correctness both hold):

1. **Compare lengths first, stringify only on length change**: keep the
   `JSON.stringify` comparison but skip it when `json.length` is unchanged
   from last time... no — length requires stringifying. Instead: keep a
   cheap pre-check that is actually cheap: compare `version` AND a
   monotonically increasing per-slug emit counter... no — versions
   collide. The honest cheap check is hashing the CHUNK (path + payload),
   not the page: `Bun.hash(chunkJson)` per frame is O(chunk), and a chunk
   whose hash matches the last chunk at the same path is a no-op re-emit.
   Fall through to the full-page stringify ONLY on chunk-hash change for
   the cross-stream identity the comment requires.

2. If even the chunk hash shows no win (small pages), STOP: record the
   numbers in the plans index as REJECTED ("measured Xms/iter at N=100 —
   below the threshold worth the risk") and change nothing.

Correctness bar for ANY candidate: the existing dedupe tests plus a new
test that emits (a) an identical payload twice across two simulated polls
   (must dedupe) and (b) a one-field-changed payload (must emit). If either
   fails, revert to the current code — the current code is correct, just
   possibly slow.

**Verify**: hook tests pass including the new one; `bun check` clean;
`biome lint` clean.

### Step 3: Format only the touched files (if any changed)

**Verify**: `bun fmt` on touched files → exit 0. `git status` shows at most
the two in-scope files. Delete `/tmp/dedupe-bench.ts`... it is in /tmp, not
the repo, so nothing to clean in the tree — but confirm `git status` is
clean of it anyway.

## Test plan

- New test ONLY if Step 2 lands a change: cross-poll identical payload
  dedupes; one-field change emits. Model on the existing NDJSON-fixture
  hook tests.
- If Step 2 concludes "not worth it", no tests, no code — the benchmark
  numbers go into the plans index rejection entry instead.

## Done criteria

Machine-checkable. ALL must hold (landed-change branch):

- [ ] Benchmark file existed in /tmp during work and is NOT in the repo (`git status` clean of it).
- [ ] New behavior test passes AND fails when the optimization is reverted (stash source change only, re-run).
- [ ] All existing hook tests pass.
- [ ] `bun check` exits 0; `biome lint` on touched files exits 0.
- [ ] `git status` shows at most the two in-scope files.
- [ ] `plans/README.md` status row updated (DONE with numbers, or REJECTED with numbers).

## STOP conditions

Stop and report back (do not improvise) if:

- The dedupe code doesn't match the "Current state" excerpt (notably the comment about version collision — if it is gone, the premise changed).
- The benchmark shows JSON.stringify is NOT the dominant cost (then the plan's premise is wrong — report the breakdown, don't go hunting for a different optimization in this plan).
- Any candidate breaks a dedupe test — revert to current code, report REJECTED with numbers.
- The fix appears to require touching versions, emit ordering, `reconcile*`, or the stream protocol — out of scope by design.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If landed: the chunk-hash is a fast path, the full-page stringify remains the cross-stream identity of record. Do NOT remove the full comparison — the hash is keyed per path and a same-path re-emit with different content MUST still fall through correctly; review any future chunk-path change against both layers.
- If rejected: the benchmark numbers in the index are the reason — re-run them before reopening, since payload sizes grow with widget count.
- `versionRef`/`versionBySlug` are render-skip versions, not dedupe identity — never conflate the two again; the comment at the emit site says why.
