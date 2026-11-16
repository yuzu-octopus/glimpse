# Plan 009: Throttle the two expensive endpoints (`?force`, `/api/speedtest/run`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/server/index.ts src/server/api.ts src/server/speedtest.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

Two routes let anyone with network access to the port convert cheap
requests into expensive work: `GET /api/page/:slug?force=1` purges the
server cache so the next fetches hit every upstream, and `POST (or GET)
`/api/speedtest/run` spawns `speedtest-cli` as a child process. Either one
composed with the client's 1s homelab poll (or a trivial loop) is an
upstream/CPU amplifier. Full authentication is explicitly out of scope for
this project (README Known deviations: "Authentication and brute-force
lockout are not implemented"; the deployment model is loopback bind +
Caddy as the external listener). What this plan adds is the cheap,
proportional defense that fits that model: per-IP rate limits on exactly
these two expensive paths, with 429 + `Retry-After`, leaving every read
path untouched.

## Current state

- `src/server/index.ts` — the only file that changes.
- The `/api/speedtest/run` branch at ~line 178: builds an NDJSON
  `ReadableStream` around `runSpeedtest(...)` and returns it. NO rate
  limit, NO method check visible at the branch (verify: read the branch
  head for a method guard; if `GET` also triggers a run, the plan covers
  both — the limit keys on path, not method).
- The `/api/page/:slug` branch at ~lines 204-215: `if
  (url.searchParams.has("force"))` → `ctx.cache.deleteByPrefix(...)`,
  then streams or builds. Same: no limit.
- Server identity: `HOST` defaults to `127.0.0.1` (`GLIMPSE_HOST` override
  documented "only for debugging behind the firewall", `:15-16`). Client
  IP for rate keying: `server.requestIP(req)` (Bun.serve API — verify it
  exists in this Bun version via `bun --help`... no: verify by reading
  `node_modules/bun-types` or a 5-line throwaway script, NOT by guessing).
  Behind Caddy the remote address is Caddy's — note this in the code
  comment so a future Caddy `X-Forwarded-For` trust decision is explicit
  and out of scope here.
- Conventions: `json(body, status, headers?)` helper; errors are JSON
  `{ error }`; no middleware framework — a module-level `Map<string,
  number[]>` of timestamps per key is the codebase-consistent mechanism
  (mirrors the in-memory `Map` caches already in this file: `pageCache`-style
  module state, `inflight` in usePageData is client-side precedent for
  Map-based request tracking).
- No server route tests exist: verification is throwaway live probes
  (Step 2), like plans 003/005 — then deleted.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint file | `biome lint src/server/index.ts` | exit 0 |
| Format file | `bun fmt src/server/index.ts` | exit 0 |
| Live probe | `curl -s -o /dev/null -w "%{http_code}" ...` (Step 2) | `200` then `429` sequence |
| Full suite | `bun run test` | only the 4 known pre-existing failures |

## Scope

**In scope** (the only file you should modify):
- `src/server/index.ts` — a small per-IP token bucket (or fixed-window counter) consulted at the top of the two expensive branches.

**Out of scope** (do NOT touch, even though they look related):
- Authentication, bearer tokens, login pages, brute-force lockout (README explicitly defers these; Caddy owns the perimeter).
- `X-Forwarded-For` trust (behind Caddy the IP is Caddy's — document it in the comment, do not implement proxy-header parsing).
- The 1s poll interval, `?force` semantics (still bypasses cache when allowed through), speedtest run mechanics, NDJSON shapes.
- Any client file, any fetcher, any TTL.

## Git workflow

- Branch: `advisor/009-guard-expensive-endpoints`
- One commit; message style: `fix(server): throttle cache-bust and speedtest endpoints per IP`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a minimal per-IP limiter and gate the two paths

At module scope in `src/server/index.ts`, next to the other module-level
`Map` state:

```ts
/** Per-IP hit timestamps for the expensive routes (?force cache-bust,
 * /api/speedtest/run). Fixed window: N hits per WINDOW_MS, then 429.
 * Keyed by server.requestIP — behind Caddy this is Caddy itself, so this
 * is a footgun guard, not perimeter auth (Caddy owns that). */
```

Limits (conservative — normal UI use never hits them, a loop does):
- `?force=1`: 10 per 60s per IP. The UI's explicit-reload path issues one
  per user click; 10/min is 10 deliberate clicks.
- `/api/speedtest/run`: 3 per 300s per IP. A speedtest run takes tens of
  seconds of subprocess + bandwidth; 3 per 5min still allows re-tests.

On exceed: `return json({ error: "rate limited" }, 429, { "retry-after": "<seconds>" })` — lowercase `retry-after` matches the file's header style
(`cache-control`, `content-type` are lowercase throughout).

Both branches must count BEFORE doing the expensive work (prefix-delete /
spawn), and a rejected request must NOT do it. Reads (`/api/page/*`
without force, `/api/config`, `/api/theme`, `/health`) are never counted.

**Verify**: `bun check` → clean. `biome lint src/server/index.ts` → clean.

### Step 2: Prove it live (throwaway probes, then delete)

- Start: `GLIMPSE_CONFIG=config.example.yml GLIMPSE_PORT=3497 bun run src/server/index.ts &` (record PID).
- Force path: `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3497/api/page/home?force=1"; done` → expect ten-or-so 200s then 429s (exact boundary per the Step-1 numbers; assert "first N are 200, remainder are 429", not exact N, to avoid coupling the probe to the constant).
- Normal page (no force) 12× → all 200 (reads untouched).
- Speedtest path: `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3497/api/speedtest/run --max-time 5` × 4 in quick succession → first 200(s), then 429. NOTE: a real run spawns speedtest-cli and streams for tens of seconds — use `--max-time 5` and abandon the stream client-side; the server-side abort path (`cancel()` → `abortController.abort()`) must reap the child (verify no stray `speedtest-cli` with `pgrep -f speedtest-cli` after; if one lingers, that is a STOP — report, do not fix the reaper in this plan).
- Kill the server (recorded PID). No repo files from this step.

**Verify**: 200-then-429 on both paths; reads all-200; no stray subprocess; no repo files added.

### Step 3: Format only the touched file

**Verify**: `bun fmt src/server/index.ts` → exit 0. `git status` shows only `src/server/index.ts`.

## Test plan

- No new permanent tests (no server route harness exists; same rationale as plans 003/005). The two live probes plus the stray-process check ARE the test.
- If a harness ever appears, the spec is: force×N+1 → 429 with retry-after; reads never 429; speedtest×M+1 → 429; child reaped on client abort.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Live probe: `?force` bath → 200s then 429s with a `retry-after` header; plain page batch → all 200.
- [ ] Live probe: repeated speedtest runs → 200(s) then 429; no stray `speedtest-cli` after client abort (`pgrep` empty).
- [ ] `bun check` exits 0.
- [ ] `biome lint src/server/index.ts` exits 0.
- [ ] `git status` shows only `src/server/index.ts` modified.
- [ ] No server process left running.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The branch heads don't match the "Current state" excerpts (notably whether `/api/speedtest/run` accepts GET — cover what exists, don't add/remove a method).
- `server.requestIP` doesn't exist in this Bun version — report the actual request-IP API surface found instead of guessing a replacement.
- A stray `speedtest-cli` survives client abort during the probe — that is a reaper bug, not a limiter bug; stop, do not fix it here (it deserves its own plan).
- The fix requires auth, proxy-header trust, Caddy config, or touching any file besides `src/server/index.ts`.
- Any legitimate UI flow 429s in normal use during the probe (e.g. the client itself issues `?force` in a loop on some path) — report which flow, stop.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The limits are footgun guards, not security boundaries — loopback + Caddy is the perimeter, and this stays true. Do not raise the limits "for convenience" without re-reading this plan.
- If Caddy ever forwards real client IPs, the key must become the forwarded IP EXPLICITLY (and only from trusted Caddy) — today it is the direct peer, documented in the comment.
- The 429 shape (`{ error: "rate limited" }` + `retry-after`) is new API surface: the client currently doesn't handle 429 on these paths — a future client change should surface "slow down" rather than a generic failure.
