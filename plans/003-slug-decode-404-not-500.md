# Plan 003: Malformed page slug returns 404, not 500

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/server/index.ts`
> If this file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

`GET /api/page/%zz` throws `URIError` inside the `Bun.serve` fetch handler,
which the runtime turns into a 500. A malformed slug is a client error — the
page does not exist and can never exist — and the API's contract for unknown
pages is a JSON 404 (`page "x" not found`). The dist-serving path in the same
file already guards the identical `decodeURIComponent` call and falls back to
the SPA; the API route was simply missed. The fix is six lines: try/catch the
decode, treat failure as unknown-page, keep the existing 404 shape.

## Current state

- `src/server/index.ts` — Bun.serve routes + `fetch` handler. The only file
  that changes.
- The guarded precedent at ~lines 106-114 (exact text below): `serveDist`
  wraps `decodeURIComponent(pathname.slice(1))` in try/catch, and on
  `URIError` falls back to `join(dist, "index.html")` with the comment
  "malformed percent-encoding (e.g. %zz) → SPA fallback, same as unknown
  path". Follow this exact style — same comment shape, same fallback
  philosophy — but the API route's fallback is the JSON 404, not the SPA.
- The unguarded site at ~line 208:

```ts
		const pageMatch = /^\/api\/page\/([^/]+)$/.exec(pathname);
		if (pageMatch) {
			const r = getConfig();
			if (!r.ok) return json({ ok: false, errors: r.errors }, 400);
			const slug = decodeURIComponent(pageMatch[1]);
			const page = r.config?.pages.find((p) => p.slug === slug);
			if (!page) return json({ error: `page "${slug}" not found` }, 404);
```

- Verified empirically (not assumed): `new URL("http://x/api/page/%zz")`
  keeps the raw `%zz` in `pathname`, `decodeURIComponent` throws `URIError`,
  and an uncaught throw in the fetch handler becomes a 500. There is no
  earlier normalization that saves this path.
- Conventions: `json(body, status)` helper for JSON responses (see :49);
  existing unknown-page 404 message is `` `page "${slug}" not found` `` —
  keep the identical shape. Server has no dedicated route test file; verify
  with a live-server curl in Step 2 (the repo runs the real server this way
  in dev: `bun run src/server/index.ts`), following the throwaway-script
  rule in AGENTS.md (verify, then remove).
- The executor needs a running server with a config: use `config.example.yml`
  (tracked) via `GLIMPSE_CONFIG=config.example.yml` — never the user's
  untracked `config.yml`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `bun check` | exit 0, "No type errors" |
| Lint file | `biome lint src/server/index.ts` | exit 0 |
| Format file | `bun fmt src/server/index.ts` | exit 0 |
| Live probe | `curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:PORT/api/page/%zz"` | `404` (today: `500`) |

## Scope

**In scope** (the only file you should modify):
- `src/server/index.ts` — wrap the one `decodeURIComponent` at the `/api/page/` route.

**Out of scope** (do NOT touch, even though they look related):
- The `serveDist` decode path — already guarded; leave it.
- Any other route, the `json()` helper, config loading, or the 404 message wording of the unknown-page branch (reuse it verbatim).
- Adding a permanent server test harness — the repo has none; a throwaway live probe is the verification, then delete it.

## Git workflow

- Branch: `advisor/003-slug-decode-404`
- One commit; message style: `fix(server): malformed page slug returns 404, not 500`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Guard the slug decode

Wrap ONLY the `decodeURIComponent(pageMatch[1])` call:

```ts
let slug: string;
try {
	slug = decodeURIComponent(pageMatch[1]);
} catch {
	// malformed percent-encoding (e.g. %zz) — same contract as unknown page
	return json({ error: 'page "%zz" not found' }, 404);
}
```

Hmm — the message should use the raw value, not the decoded one (there is
no decoded one). Use `pageMatch[1]` in the message: `` `page "${pageMatch[1]}" not found` ``.
That keeps the identical shape as the unknown-page 404 one line below, so
clients see one 404 contract. Do NOT extract a helper, do NOT touch the
`getConfig` order (config errors stay 400 and take precedence, as today).

**Verify**: `bun check` → clean. `biome lint src/server/index.ts` → clean.

### Step 2: Prove it against a live server (throwaway probe)

- Start the server bound to loopback on an ephemeral port with the example
  config: `GLIMPSE_CONFIG=config.example.yml GLIMPSE_PORT=3499 bun run src/server/index.ts &`
  (background it; record the PID).
- `curl -s "http://127.0.0.1:3499/api/page/%zz"` → expect
  `{"error":"page \"%zz\" not found"}` with HTTP 404.
- Sanity: `curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3499/api/page/nope"` → still `404` with the old message; and `/health` → `200`.
- Kill the server (kill the recorded PID). Nothing from this step enters the repo — no script file, no fixture.

**Verify**: malformed slug → 404 JSON (today: 500); unknown slug → unchanged 404; `/health` → 200.

### Step 3: Format only the touched file

**Verify**: `bun fmt src/server/index.ts` → exit 0. `git status` shows only `src/server/index.ts`.

## Test plan

- No new permanent tests: the repo has no server-route test harness, and
  building one for a six-line guard is disproportionate. The throwaway live
  probe in Step 2 IS the test — it exercises the exact failing input
  (`%zz`) through the real `Bun.serve` stack, which is stronger than a
  unit test of a try/catch would be.
- If the maintainer later wants it pinned, the probe commands above are the
  spec for a future route-test file.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Live probe: `GET /api/page/%zz` returns HTTP 404 with the unknown-page JSON shape.
- [ ] Live probe: `GET /api/page/nope` still returns the old 404; `/health` still 200.
- [ ] `bun check` exits 0.
- [ ] `biome lint src/server/index.ts` exits 0.
- [ ] `git status` shows only `src/server/index.ts` modified.
- [ ] No server process left running (kill the Step-2 PID; verify with a second curl refusing connection).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The route code doesn't match the "Current state" excerpt.
- The live probe shows anything other than 500-before / 404-after (e.g. the connection is refused because the port is taken — pick another ephemeral port and retry once, then stop if it still fails).
- Fixing this requires touching the dist path, the `json()` helper, or any route other than `/api/page/`.
- A server test harness appears to be required — this plan explicitly avoids building one; report instead.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Any future `decodeURIComponent` on request input needs the same guard — the dist path and now the page route are both covered; a new route with a slug or filename param is the place this recurs.
- The 404 message intentionally echoes the raw (still-encoded) slug, so a log line for `%zz` reads as the request the client sent, not a decode artifact.
