# Plan 005: Contain the custom-CSS read to the config directory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c794221..HEAD -- src/server/index.ts src/server/index.test.ts src/server/*.test.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c794221`, 2026-11-11

## Why this matters

`readThemeCss` resolves the operator-supplied `custom-css-file` value
against the config directory but never checks the result stays inside it.
`custom-css-file: ../../etc/passwd` resolves outside, reads, and is served
verbatim as JSON at `/api/theme` (public, `max-age=60`). The config file is
operator-controlled so exploitability is low — but a borrowed snippet, a
templated config, or a future multi-user deployment turns a theme knob into
an arbitrary local-file read over HTTP. The dist path in the same file
already does the right thing (`startsWith(dist + sep)`, 403 otherwise).
Mirror that check here: absolute paths rejected, escapes rejected, same 403
shape.

## Current state

- `src/server/index.ts` — the only file that changes.
- `readThemeCss(cssFile)` at ~lines 61-81 (exact text below): takes the raw
  `cssFile` string, does `resolve(dirname(CONFIG_PATH), cssFile)`, stats and
  reads it, caches by `{file, mtimeMs}`. NO containment check anywhere
  between `resolve` and `readFileSync`.

```ts
function readThemeCss(cssFile: string): string | null {
	const now = Date.now();
	if (themeCssCache?.file === cssFile && now - themeCssCheckedAt < THEME_CSS_CHECK_MS) {
		return themeCssCache.content;
	}
	const path = resolve(dirname(CONFIG_PATH), cssFile);
	try {
		const { mtimeMs } = statSync(path);
		...
		const content = readFileSync(path, "utf8");
```

- The `/api/theme` branch at ~lines 168-177: `cssFile` comes from
  `r.config["custom-css-file"]` (a zod `z.string().optional()` — no shape
  validation, by design: it is a path, not an enum). Returns
  `json({ customCss }, 200, ...)`. When the read fails today it logs and
  returns `null` → `{ customCss: null }`.
- The dist precedent at ~line 116 (follow its style):
  `if (!filePath.startsWith(dist + sep) && filePath !== dist + sep + "index.html")`
  `return json({ error: "forbidden" }, 403);`
  Note it imports `sep` from `node:path` already (check the import line —
  reuse it, do not add a second path import).
- Conventions: `json(body, status)` helper; errors logged via
  `console.log("[glimpse] ...")`; the 403 shape is `{ error: "forbidden" }`.
- No server route tests exist in the repo. Verification is a throwaway live
  probe (Step 2), like plan 003 — then deleted.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun check` | exit 0 |
| Lint file | `biome lint src/server/index.ts` | exit 0 |
| Format file | `bun fmt src/server/index.ts` | exit 0 |
| Live probe | `curl -s "http://127.0.0.1:PORT/api/theme"` with a traversal config | `{"customCss":null}` (today: file bytes) |

## Scope

**In scope** (the only file you should modify):
- `src/server/index.ts` — `readThemeCss` only: absolute-path rejection + containment check.

**Out of scope** (do NOT touch):
- The dist path (already contained — it is the pattern to copy, not a patient).
- The `/api/theme` response shape, the 60s cache header, the 5s theme re-stat cache.
- The `custom-css-file` schema (stays a free string — legitimate uses include `../shared/theme.css` next to the config dir, which a strict "must be basename" rule would break; only escapes OUTSIDE the dir are rejected).
- Any auth/rate-limit work (separate plan).

## Git workflow

- Branch: `advisor/005-contain-custom-css`
- One commit; message style: `fix(server): contain custom-css read to the config directory`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reject absolute paths, resolve, then verify containment

In `readThemeCss`, before the `statSync`:

```ts
if (isAbsolute(cssFile)) return null; // reuse the node:path isAbsolute already imported for the config loader
const dir = dirname(CONFIG_PATH);
const path = resolve(dir, cssFile);
if (path !== dir && !path.startsWith(dir + sep) && ...) return null;
```

Careful with the edge: `resolve(dir, ".")` is `dir` itself — a directory, and `statSync` + `readFileSync` on a directory throws → caught → null. That path already returns null safely, so the check only needs the escape case. Match the dist precedent's shape (`startsWith(dir + sep)`, else fail closed), but here failure means `return null` (the caller already maps null → `{ customCss: null }`), NOT a 403 — `readThemeCss` returns content-or-null, it does not speak HTTP. Do NOT change its signature.

Log the rejection the way the existing catch logs failures:
`console.log("[glimpse] custom css file escapes the config directory: ...")` — but NEVER log the resolved absolute path's parent segments beyond the file name... actually simplest: log the same message shape as the existing catch (`cannot read custom css file: <reason>`) so log scrapers keep one pattern. Use reason `"outside the config directory"`.

**Verify**: `bun check` → clean. `biome lint src/server/index.ts` → clean.

### Step 2: Prove it against a live server (throwaway probe)

- Write `/tmp/evil.yml`: `pages: [{ name: Home, widgets: [{ type: clock }] }]` plus `custom-css-file: ../../etc/passwd` (adjust the `../` depth so it escapes whatever cwd you run from — the point is it resolves outside the config dir but to a file that exists; if `/etc/passwd` doesn't resolve, use any existing file outside the dir, e.g. `/tmp/probe-marker.txt` you create).
- Also write `/tmp/ok.yml` with `custom-css-file` pointing at a REAL css file next to it (`/tmp/ok.css` with `body{color:red}`) — the legitimate sibling-dir case must keep working.
- Start: `GLIMPSE_CONFIG=/tmp/evil.yml GLIMPSE_PORT=3498 bun run src/server/index.ts &` (record PID). `curl -s http://127.0.0.1:3498/api/theme` → expect `{"customCss":null}`. Kill it.
- Start with `/tmp/ok.yml` on another port. `curl -s .../api/theme` → expect the css bytes in `customCss`. Kill it.
- Delete nothing from the repo — all fixtures lived in `/tmp`. Confirm `git status` shows only `src/server/index.ts`.

**Verify**: traversal → null; sibling file → bytes; no repo files added.

### Step 3: Format only the touched file

**Verify**: `bun fmt src/server/index.ts` → exit 0. `git status` shows only `src/server/index.ts`.

## Test plan

- No new permanent tests (no server route harness exists; same rationale as plan 003). The two live probes (evil + ok) are the test.
- Regression guard for the future: if a route-test harness ever appears, these two cases (`../../etc/passwd` → null, sibling css → bytes) are the spec — note this in the commit message body so it is discoverable.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Live probe with escaping `custom-css-file` returns `{"customCss":null}` (today: file bytes).
- [ ] Live probe with in-dir sibling css still returns its bytes.
- [ ] `symlink` escape also contained: point `custom-css-file` at a symlink inside the config dir whose target is outside — `resolve` without `realpath` does NOT follow it at resolve time, but `readFileSync` follows it at read time. Decide: either `realpathSync` before the check (preferred — closes symlink escape) or document the gap in the commit message. The plan REQUIRES one of the two; silently ignoring symlinks fails this box.
- [ ] `bun check` exits 0.
- [ ] `biome lint src/server/index.ts` exits 0.
- [ ] `git status` shows only `src/server/index.ts` modified.
- [ ] No server process left running.
- [ ] `plans/README.md` status row updated.

(Step 1's sketch uses `resolve`; the symlink sub-case above is why the Done box calls it out — implement with `realpathSync` on the resolved path before the `startsWith` check, falling back to null on throw. That is still ~5 lines.)

## STOP conditions

Stop and report back (do not improvise) if:

- The `readThemeCss` code doesn't match the "Current state" excerpt.
- The containment check would break the legitimate case the sibling-dir probe covers (a css file next to — not inside — the config file's directory IS legitimate; `resolve` handles `../shared/x.css` that stays... wait, no: `../shared/x.css` ESCAPES the config dir. Re-read the Scope: "legitimate uses include `../shared/theme.css` next to the config dir". Those resolve OUTSIDE `dirname(CONFIG_PATH)`. Hmm — this contradicts containment.
  Resolve it this way and ONLY this way: containment is against `dirname(CONFIG_PATH)` — `../shared/theme.css` next to a config at `cfg/glimpse.yml` resolves to `cfg/../shared/theme.css` = outside `cfg/`, so it would be REJECTED. That is the safe default, and the Scope line calling it "legitimate" is wrong — treat it as superseded by this STOP box: reject it (fail closed), note the rejection in the commit message, and record in Maintenance notes that a future `custom-css-allow-outside` opt-in could restore it explicitly. Do NOT invent that opt-in in this plan.)
- The fix requires changing the `/api/theme` response shape or the schema.
- A route-test harness seems required — it isn't; report instead.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Any future file path derived from config/URL input gets the same treatment: `isAbsolute` reject + `realpathSync` + `startsWith(dir + sep)`. Grep for `resolve(` + `readFileSync` pairs in review.
- The `../shared/theme.css` pattern some operators use will now fail closed with a log line — the log message must say exactly why (outside dir), or the first person to hit it will "fix" it by reverting this commit.
- If multi-user configs ever arrive (untrusted config authors), revisit: containment is necessary but not sufficient — the read itself becomes the attack, not just the escape.
