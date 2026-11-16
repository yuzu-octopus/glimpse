# Plan 006: Cap concurrent upstream fetches per page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/server/api.ts src/server/warmup.ts src/server/widgets/http.ts src/server/widgets/runtime.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

`buildPagePayload` fans out one upstream fetch per widget with no cap
(nested `Promise.all` per column, one per widget inside), each with up to
`retries: 3` + backoff inside `fetchWithRetry`. A page with N feeds opens N
concurrent upstream connections per poll — and the homelab 1s poll (plus
`?force=1` cache-busting, plus a flapping upstream with no negative cache)
multiplies it into a retry storm. Warmup already caps *pages* at 6
(`WARMUP_CONCURRENCY`), which proves the codebase accepts concurrency caps
as the mechanism — widgets are the uncapped half. The stream already
handles out-of-order chunk arrival (`streamPagePayload` resolves in settle
order), so capping changes timing, not correctness.

## Current state

- `src/server/api.ts` — `buildPagePayload(page, ctx)` at ~lines 44-95:
  `buildColumn` maps each widget to `fetchWidget(...)` inside a bare
  `Promise.all` per column; head/flat/columns promises join in one more
  `Promise.all` at ~line 92. `fetchWidget` (above it, ~lines 24-42) fans out
  children recursively the same way. No semaphore anywhere on this path.
- `src/server/warmup.ts:8` — `WARMUP_CONCURRENCY = 6`, the established
  precedent: a module-level const, a comment explaining what it bounds, and
  a worker-pool loop. Follow this shape — do not introduce a p-limit
  dependency (no new deps; a ~15-line semaphore matches the codebase).
- `src/server/widgets/runtime.ts:39` — TTLs already layer (`cache` string
  else `getDefaultTtl`); the negative-cache addition below slots into the
  same function.
- `src/server/widgets/http.ts:91-95` — `for (attempt = 0; attempt <=
  retries; ...)` with `retries ?? DEFAULT_RETRIES` (default 3). Retries
  stay as-is; the cap and the negative cache reduce how often they fire,
  not what they do.
- Conventions: server fetchers re-validate per fetch (defense in depth);
  Bun-native (`Bun.serve`, `Bun.file`); fake-timer widget tests exist
  (`widget-behavior.test.ts` pattern — follow it for the new tests).
- The stream contract (settle-order chunks, `$skeleton` first) is what
  makes reordering safe — cite `streamPagePayload`'s resolved-queue in the
  commit message, not in code.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint touched | `biome lint <touched files>` | exit 0 |
| Targeted tests | `bun run test src/server/api.test.ts src/server/widgets/widget-behavior.test.ts` | all pass |
| Full suite | `bun run test` | only the 4 known pre-existing failures |
| Format | `bun fmt <touched files>` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/server/api.ts` — per-page semaphore around `fetchWidget` calls.
- `src/server/widgets/runtime.ts` — short negative cache for hard failures (5–10s).
- `src/server/api.test.ts` — two new tests (cap respected under fake fetch; hard failure cached).

**Out of scope** (do NOT touch):
- `fetchWithRetry` retry counts, delays, or abort handling (`http.ts` untouched).
- Warmup (`warmup.ts` untouched — pages already capped).
- The 1s homelab poll interval, `?force` semantics, the NDJSON protocol, chunk shapes, or stream ordering.
- Any client file, any TTL value, any fetcher.

## Git workflow

- Branch: `advisor/006-cap-widget-fanout`
- Commits: one per step below (semaphore; negative cache; tests). Message style: `perf(server): ...`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Per-page semaphore (cap 6, same number as warmup)

Add a tiny semaphore next to `WARMUP_CONCURRENCY`'s philosophy — but in
`api.ts`, not warmup (per-page, not per-boot):

```ts
/** Max concurrent upstream fetches while building one page. Warmup caps
 * pages at 6; this caps widgets for the same reason: an unbounded fan-out
 * turns one poll of a feed-heavy page into N simultaneous upstreams. */
```

Wrap the `fetchWidget` call inside `buildColumn`'s map AND the recursive
children fan-out AND the head/flat maps — every `fetchWidget` invocation
that belongs to one `buildPagePayload` call must acquire the same
per-call semaphore (not a global: two pages building concurrently must not
starve each other; create it inside `buildPagePayload` and close over it).
A simple implementation: an array-as-queue of resolvers,
`const acquire = () => active < 6 ? (active++, Promise.resolve(release)) : new Promise(...)`.

The chunk SETTLE ORDER may change under contention — that is expected and
safe (the stream resolves in settle order by design). What must NOT change:
every widget still gets exactly one frame, errors still carry per-widget,
and `$skeleton` still goes first.

**Verify**: `bun run test src/server/api.test.ts` → pass. `bun check` → clean. `biome lint src/server/api.ts` → clean.

### Step 2: Short negative cache for hard failures

In `runtime.ts`'s fetch path (the stale-on-error wrapper), cache
connection-refused / 5xx-class failures for a SHORT TTL (5–10s, pick 5s and
name the const `NEGATIVE_TTL_MS`), so a flapping upstream polled every
second retries at most ~12/min/widget instead of 4/sec. Successes and
2xx-cached behavior unchanged; `?force=1` must still bypass (it clears the
prefix today — keep that exact behavior, including for negative entries).

Key it the same way as the positive cache (`slug:path` templates in
`api.ts` — reuse them, do not invent new key shapes).

**Verify**: new test (Step 3 covers it) plus `bun run test src/server/widgets/widget-behavior.test.ts` → pass.

### Step 3: Two tests proving the bounds

In `src/server/api.test.ts` (following the existing fetcher-injection
pattern with fake timers, NOT real network):

1. **Cap test**: page with e.g. 20 widgets, each fetcher recording
   concurrent depth (increment on entry, decrement on exit, track max).
   Assert max depth ≤ 6 AND every widget still got exactly one frame.
2. **Negative-cache test**: fetcher that throws (connection refused style);
   two `buildPagePayload` calls within the negative TTL; assert the fetcher
   ran once (second call served the negative entry). Then advance past the
   TTL and assert it runs again.

**Verify**: `bun run test src/server/api.test.ts` → all pass including the two new tests. Then: temporarily set the cap to 1 in source, re-run test 1, confirm it still passes but slower (proves the test actually exercises the semaphore rather than passing vacuously); restore 6.

### Step 4: Format only the touched files

**Verify**: `bun fmt src/server/api.ts src/server/widgets/runtime.ts src/server/api.test.ts` → exit 0. `git status` shows only those three files.

## Test plan

- New tests in `src/server/api.test.ts` (Step 3): concurrency cap + negative cache, per the file's existing fetcher-injection pattern with fake timers.
- Full suite must show no NEW failures (the 4 pre-existing baseline failures stay: rss smart-quote, videos playlist/lockups, local jetbrains).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Concurrency test passes, and fails-if-cap-removed (set cap to Infinity, test must fail — proves it measures the cap).
- [ ] Negative-cache test passes, and `?force=1` still bypasses (add that assertion: force after a negative entry re-runs the fetcher).
- [ ] `bun run test` shows no failures beyond the 4 known pre-existing ones.
- [ ] `bun check` exits 0.
- [ ] `biome lint` on touched files exits 0.
- [ ] `git status` shows only the three in-scope files.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `buildPagePayload` fan-out doesn't match the "Current state" shape (e.g. already capped upstream of this plan).
- The semaphore changes chunk ORDER guarantees the stream tests pin (settle order may shift; a *missing* or *duplicated* frame is a bug, not a timing change — stop).
- The negative cache interacts with `?force` in a way the force-bypass assertion can't pin — report, don't redesign cache invalidation.
- Fixing this requires touching `http.ts` retries, warmup, the client, or any TTL value.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The per-page cap (6) and the warmup cap (6) are the same number for the same reason but are NOT the same knob — one bounds widgets within a page build, the other bounds pages within a boot. Do not "dedupe" them into one const; their blast radii differ.
- The negative TTL (5s) is deliberately shorter than every positive TTL including the 1s homelab tier — a longer negative cache would mask recovery. If the homelab interval ever drops below 5s, revisit.
- Watch the chunk-settle tests: any future change to fetch ordering (priority, deadlines) must keep the "every widget gets exactly one frame" invariant the new tests pin.
