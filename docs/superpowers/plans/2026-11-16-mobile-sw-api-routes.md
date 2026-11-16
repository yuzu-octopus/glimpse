# SW API Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the service worker's three API runtime-caching routes actually match requests, and keep streamed page responses out of the cache.

**Architecture:** Workbox's `RegExpRoute` tests `url.href` (absolute), while the three `urlPattern` regexes in `vite.config.ts` are anchored to a relative path, so none ever match: there is no offline cache or stale-while-revalidate today. Replace them with exported predicate functions that test `url.pathname`, directly unit-testable in Vitest. The page predicate additionally rejects any URL with a `stream` search param because those responses are `no-store` NDJSON (`src/server/index.ts:324-329`) and caching one would replay a truncated page.

**Tech Stack:** Bun 1.4.4, Vite + vite-plugin-pwa (Workbox), strict TypeScript, Vitest 5 with jsdom.

**Spec:** `/tmp/mobile-findings.md` — finding M02, reproduced verbatim:

> M02 — Dead SW API routes (PERF-02, S, HIGH)
> Evidence: `vite.config.ts:60,72,81` — `urlPattern: /^\/api\/config(\?.*)?$/` etc.; Workbox `RegExpRoute` tests `url.href` (absolute), so none match. `dist/sw.js` confirms verbatim regexes. Impact: no offline cache, no stale-while-revalidate. Fix: function urlPatterns on `url.pathname`; explicitly EXCLUDE `?stream` (`url.searchParams.has("stream")`) from `/api/page/` caching because those responses are `no-store` NDJSON (server `src/server/index.ts:324-329`) and a cached stream would be replayed as a truncated page. Test: a small vitest unit over the pattern predicates (export them from a helper if needed) asserting absolute URL matches `/api/config` and `/api/page/home` but not `/api/page/home?stream`.

## Global Constraints

- Bun 1.4.4, React 19, Astryx kit via @astryxdesign/core + astryx-dracula 0.9.0; no new dependencies.
- strict TS, `verbatimModuleSyntax`, no ReturnType aliases (except documented spawn-typing precedent), no inline casts, unconditional hooks.
- Kit components before custom CSS; no hex colours; purple=tappable only.
- Every task ends with a checkable test/command; no formatter runs by implementers (orchestrator formats once).
- No push. Atomic commit per completed plan, message names the plan.

Executor note: the orchestrator owns commits, so each task ends with a verification command rather than a commit step.

## Review Focus

- Workbox hands predicates an absolute URL, so origin and query string must not defeat matching — pinned by Task 1, `matches absolute config, theme and page URLs`.
- Non-stream query strings (`?v=1`) on cacheable endpoints must still match — pinned by Task 1, `keeps query strings on non-stream endpoints cacheable`.
- A streamed page response must never be cached, even with extra params — pinned by Task 1, `does not cache streamed page responses`.
- Near-miss paths must not be cached into the wrong cache — pinned by Task 1, `rejects near-miss paths`.
- Leaving one old regex in `vite.config.ts` silently kills that route again — pinned by Task 2, `wires the predicates into every SW API route`.

---

### Task 1: Export and test pathname-based route predicates

**Files:**
- Create: `src/sw/apiPatterns.ts`
- Create: `src/sw/apiPatterns.test.ts`

**Interfaces:**
- Consumes: `URL.pathname` and `URL.searchParams` from the WHATWG `URL` passed in Workbox's match callback.
- Produces: three named exports, each of type `(params: { url: URL }) => boolean`:
  - `apiConfigPattern` — true iff `pathname === "/api/config"`.
  - `apiPagePattern` — true iff `pathname.startsWith("/api/page/")` and `!searchParams.has("stream")`.
  - `apiThemePattern` — true iff `pathname === "/api/theme"`.

- [ ] **Step 1: Write the failing test**

Create `src/sw/apiPatterns.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { apiConfigPattern, apiPagePattern, apiThemePattern } from "./apiPatterns";

const at = (path: string): { url: URL } => ({ url: new URL(path, "https://glimpse.local") });

describe("apiPatterns", () => {
	it("matches absolute config, theme and page URLs", () => {
		expect(apiConfigPattern(at("/api/config"))).toBe(true);
		expect(apiThemePattern(at("/api/theme"))).toBe(true);
		expect(apiPagePattern(at("/api/page/home"))).toBe(true);
		expect(apiConfigPattern(at("https://other.example/api/config?foo=1"))).toBe(true);
	});

	it("keeps query strings on non-stream endpoints cacheable", () => {
		expect(apiConfigPattern(at("/api/config?v=1"))).toBe(true);
		expect(apiThemePattern(at("/api/theme?v=1"))).toBe(true);
		expect(apiPagePattern(at("/api/page/home?v=1"))).toBe(true);
	});

	it("does not cache streamed page responses", () => {
		expect(apiPagePattern(at("/api/page/home?stream"))).toBe(false);
		expect(apiPagePattern(at("/api/page/home?stream=true"))).toBe(false);
		expect(apiPagePattern(at("/api/page/home?stream=1&v=2"))).toBe(false);
	});

	it("rejects near-miss paths", () => {
		expect(apiConfigPattern(at("/api/configuration"))).toBe(false);
		expect(apiThemePattern(at("/api/theme-editor"))).toBe(false);
		expect(apiPagePattern(at("/api/page"))).toBe(false);
		expect(apiPagePattern(at("/assets/page/home"))).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/sw/apiPatterns.test.ts`
Expected: FAIL — `./apiPatterns` cannot be resolved yet.

- [ ] **Step 3: Implement the three predicates**

Create `src/sw/apiPatterns.ts` with exactly the signatures in Interfaces and one-line bodies implementing the stated pathname/searchParams rules. No default exports, no extra helpers.

- [ ] **Step 4: Run the test and gates to verify it passes**

Run: `bun run test src/sw/apiPatterns.test.ts`
Expected: PASS (4 tests).
Run: `bun check`
Expected: no type errors.
Run: `biome lint src/sw/apiPatterns.ts src/sw/apiPatterns.test.ts`
Expected: no diagnostics.

---

### Task 2: Wire the predicates into the Workbox config

**Files:**
- Modify: `vite.config.ts:1-6` (add one import), `vite.config.ts:54-89` (replace the three `urlPattern` regexes)
- Modify: `src/sw/apiPatterns.test.ts` (append the wiring guard)

**Interfaces:**
- Consumes: `apiConfigPattern`, `apiPagePattern`, `apiThemePattern` from Task 1.
- Produces: `vite.config.ts` runtimeCaching routes whose `urlPattern` values are the imported functions; handler and options blocks stay byte-for-byte unchanged.

- [ ] **Step 1: Write the failing wiring guard**

Append to `src/sw/apiPatterns.test.ts` (add `import { readFileSync } from "node:fs";` at the top):

```ts
	it("wires the predicates into every SW API route", () => {
		const config = readFileSync("vite.config.ts", "utf8");
		expect(config).toContain("urlPattern: apiConfigPattern");
		expect(config).toContain("urlPattern: apiPagePattern");
		expect(config).toContain("urlPattern: apiThemePattern");
		expect(config).not.toContain('/^\\/api\\/config');
		expect(config).not.toContain('/^\\/api\\/page\\//');
		expect(config).not.toContain('/^\\/api\\/theme');
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/sw/apiPatterns.test.ts`
Expected: FAIL — `vite.config.ts` still contains the three regexes.

- [ ] **Step 3: Wire the predicates**

Add `import { apiConfigPattern, apiPagePattern, apiThemePattern } from "./src/sw/apiPatterns";` to `vite.config.ts`, then replace only the three `urlPattern:` expressions at lines 60, 72 and 81 with the imported function names in the order config → page → theme. Leave every `handler` and `options` block untouched.

- [ ] **Step 4: Run the tests and gates to verify it passes**

Run: `bun run test src/sw/apiPatterns.test.ts`
Expected: PASS (5 tests).
Run: `bun run build`
Expected: exit 0; `dist/sw.js` generated.
Run: `bun check`
Expected: no type errors.
Run: `biome lint vite.config.ts src/sw/apiPatterns.test.ts`
Expected: no diagnostics.
Run: `bun fmt --check '**/*.{ts,tsx,mjs,js,jsx,json,css}'`
Expected: no formatting differences (the orchestrator formats once, outside this plan).
