# Perceived-Instant Page Loading Implementation Plan — EXECUTED 2026-08-23

> **Status: COMPLETE.** All tasks implemented, reviewed (subagent-driven, per-task review + final whole-branch review), merged to `main`. Commits `00e4b65`…`6c4a5a3`. As-built deviations from the text below:
> - **Task 1:** reader.cancel() on abort + `res.body` null guard added during review (not in original sketch); trailing-line flush + abort-mid-stream tests added.
> - **Task 3:** `warmCache(ctx)` takes ctx as a parameter (not imported from index.ts — avoids circular import); deletes all slug prefixes before warming (stale-cache-on-config-edit fix); `initConfig(path, onChange?)` gained an onChange callback; reload re-warm guarded on `r.ok`.
> - **Task 4:** existing skeleton tests updated to advance fake timers (250ms delay would otherwise hang them).
> - **Final review fixes:** copy-on-write `base.widgets` array in `applyChunk` (flat BentoGrid memo staleness — latent, no flat page currently configured); inflight delete identity guard (`inflight.get(slug) === p`).
> - **Not wired:** `reload(true)`/`?force=1` has no UI trigger (no reload button exists); path is unit-tested end-to-end.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Glimpse pages paint progressively — fast widgets appear immediately, slow widgets show type-shaped skeletons — instead of buffering the whole stream behind a generic page skeleton.

**Architecture:** Four independent fixes layered on the existing NDJSON stream: (1) client reads the stream incrementally instead of `res.text()`, (2) `WidgetChrome` gains typed skeleton variants, (3) server warms its TTL cache at boot/config-change, (4) delayed skeleton suppresses <300ms flashes. Research basis: `research/page-loading/REPORT.md`.

**Tech Stack:** Bun.serve streaming (existing), React 19, Vitest + RTL, no new deps.

## Global Constraints

- Bun ≥1.3; never node/npm/npx — `bun`, `bunx`.
- Gates after all tasks: `bunx tsc --noEmit` clean · `bun run test` green · `npx react-doctor@latest` full scan 100/100.
- Memo invariant (load-bearing): streaming replaces whole widget object refs (`applyChunk` never mutates rendered payloads) — do not break.
- Stream wire contract unchanged: first NDJSON line `{path:'$skeleton',payload}`, then `{path,payload}` chunks; cache-key paths (`h:i`,`w:i`,`c:ci:wi`) differ from chunk paths — keep both.
- Zod v4 conventions; strict TS; no inline casts except CSSProperties custom-var objects.
- No new dependencies.

---

### Task 1: Incremental NDJSON reading (root cause)

**Files:**
- Modify: `src/client/hooks/usePageData.ts:104-153` (the `fetchPage` body)
- Test: `src/client/hooks/usePageData.test.tsx`

**Interfaces:**
- Consumes: existing `applyChunk(base, path, payload)`, `skeletonOf(chunk)`, `reconcileWithCached(skeleton, cached)`, `setCache(slug, base)`.
- Produces: same `PageDataResult` behavior — no signature changes. Chunks apply to UI *as they arrive* (per-chunk `onProgress`) instead of after full buffer.

The bug: `fetchPage` currently does `const text = await res.text();` then splits lines — so nothing renders until the slowest widget settles. Fix: read `res.body` with `getReader()`, decode incrementally, process each complete line as it arrives.

- [ ] **Step 1: Write failing test**

Add to `usePageData.test.tsx` (follows existing NDJSON fixture style — stubbed `fetch` returning a `Response` whose body is a `ReadableStream` that stays open):

```ts
it('renders early chunks before the stream closes', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const enc = new TextEncoder();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
    start(c) { controller = c; },
  }), { headers: { 'content-type': 'application/x-ndjson' } })));
  const { result } = renderHook(() => usePageData('p1'));
  __clearCacheForTests();
  // flush microtasks so the hook starts fetching
  await act(async () => {});
  controller.enqueue(enc.encode(JSON.stringify({ path: '$skeleton', payload: SKELETON }) + '\n'));
  await act(async () => {});
  expect(result.current.data).not.toBeNull(); // skeleton painted WITHOUT closing stream
  controller.enqueue(enc.encode(JSON.stringify({ path: 'widgets[0]', payload: W0 }) + '\n'));
  await act(async () => {});
  expect(result.current.data?.widgets?.[0]?.data).toEqual(W0.data); // chunk applied live
  controller.close();
  await act(async () => {});
});
```

(`SKELETON`/`W0` mirror the file's existing fixture shapes; reuse existing helpers.)

- [ ] **Step 2: Run test, verify FAIL**

Run: `bunx vitest run src/client/hooks/usePageData.test.tsx`
Expected: FAIL — `data` is null because `res.text()` never resolves on an open stream.

- [ ] **Step 3: Implement incremental reader**

Replace the buffered section of `fetchPage`:

```ts
const ct = res.headers.get('content-type') ?? '';
const isNdjson = ct.includes('ndjson');

if (!isNdjson) {
  // unchanged: single JSON document path (reads full text — fine, non-stream)
  const text = await res.text();
  …existing…
}

const cached = force ? null : getCached(slug);
const cachedBase = cached ? structuredClone(cached) : null;
let base: PagePayload | null = null;
// ...skeletonOf as today...

const handleLine = (line: string): void => {
  if (!line.trim() || signal.aborted) return;
  let chunk: { path?: string; payload?: unknown };
  try { chunk = JSON.parse(line); } catch { return; }
  const skeleton = skeletonOf(chunk);
  if (skeleton) {
    if (!base) {
      base = cachedBase ? reconcileWithCached(skeleton, cachedBase) : skeleton;
      if (!signal.aborted) onProgress?.({ ...base });
    }
    return;
  }
  if (!base) {
    if (!cachedBase) return;
    base = cachedBase;
    if (!signal.aborted) onProgress?.({ ...base });
  }
  if (!chunk.path) return;
  applyChunk(base!, chunk.path!, chunk.payload);
  if (!signal.aborted) onProgress?.({ ...base! });
};

const reader = res.body!.getReader();
const dec = new TextDecoder();
let buf = '';
for (;;) {
  const { done, value } = await reader.read();
  if (done || signal.aborted) break;
  buf += dec.decode(value, { stream: true });
  let nl: number;
  while ((nl = buf.indexOf('\n')) >= 0) {
    handleLine(buf.slice(0, nl));
    buf = buf.slice(nl + 1);
  }
}
buf += dec.decode();
handleLine(buf);
if (!base) throw new Error('empty stream');
setCache(slug, base);
return base;
```

Keep the surrounding `inflight` set/delete and abort plumbing exactly as-is. Delete the old split-loop.

- [ ] **Step 4: Run tests, verify PASS**

Run: `bunx vitest run src/client/hooks/usePageData.test.tsx`
Expected: PASS including the new test and all existing NDJSON-fixture tests.

- [ ] **Step 5: Commit**

```bash
git add src/client/hooks/usePageData.ts src/client/hooks/usePageData.test.tsx
git commit -m "perf: consume NDJSON incrementally so widgets paint as chunks arrive"
```

---

### Task 2: Type-shaped skeletons in WidgetChrome

**Files:**
- Modify: `src/client/components/WidgetChrome.tsx` (loading block)
- Modify: `src/shared/widgets/preferredSizes.ts` (add exported `SKELETON_SHAPE: Record<string, 'list'|'stat'|'chart'|'rows'>`)
- Modify: `src/client/pages/PageView.tsx` (`WidgetSkeleton` passes shape from widget type)
- Test: `src/client/components/WidgetChrome.test.tsx`

**Interfaces:**
- Consumes: Astryx `Skeleton` (already imported).
- Produces: `WidgetChrome` prop `skeletonShape?: 'list' | 'stat' | 'chart' | 'rows'`; shared map `SKELETON_SHAPE` keyed by widget type. Default `'list'`.

Shapes (Primer/Ant/MUI guidance — match final content silhouette):
- `list` (rss, hacker-news, lobsters, reddit, releases): 5 rows of `[circle 24px, two lines]`
- `stat` (clock, weather, markets, server-stats, system-stats, repository): big block 48px + short line
- `chart` (videos, custom-api): wide block `height 120`
- `rows` (monitor, bookmarks, todo, search, calendar, dns-stats, docker-containers, iframe, html): 3 full-width lines

- [ ] **Step 1: Add SKELETON_SHAPE map**

In `src/shared/widgets/preferredSizes.ts`:

```ts
/** Skeleton silhouette per widget type (WidgetChrome loading state). */
export const SKELETON_SHAPE: Record<string, 'list' | 'stat' | 'chart' | 'rows'> = {
  rss: 'list', 'hacker-news': 'list', lobsters: 'list', reddit: 'list', releases: 'list',
  clock: 'stat', weather: 'stat', markets: 'stat', 'server-stats': 'stat',
  'system-stats': 'stat', repository: 'stat',
  videos: 'chart', 'custom-api': 'chart',
};
// anything absent -> 'rows'
```

- [ ] **Step 2: Write failing tests**

In `WidgetChrome.test.tsx`:

```ts
it('renders list-shaped skeleton rows', () => {
  render(<WidgetChrome title="Feed" isLoading skeletonShape="list" />);
  expect(screen.getByTestId('widget-loading')).toHaveClass('shapeList');
});
it('renders stat-shaped skeleton', () => {
  render(<WidgetChrome title="Clock" isLoading skeletonShape="stat" />);
  expect(screen.getByTestId('widget-loading')).toHaveClass('shapeStat');
});
```

(Class names come from CSS modules — assert via the class token the component applies.)

- [ ] **Step 3: Implement**

`WidgetChrome` props += `skeletonShape?: 'list' | 'stat' | 'chart' | 'rows'`. Loading block becomes:

```tsx
{isLoading ? (
  <div className={`${styles.skeleton} ${shapeClass}`} data-testid="widget-loading">
    {shape === 'list' ? (
      Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={styles.listRow}>
          <Skeleton width={24} height={24} borderRadius="50%" />
          <div className={styles.listLines}>
            <Skeleton width="70%" height={12} />
            <Skeleton width="45%" height={10} />
          </div>
        </div>
      ))
    ) : shape === 'stat' ? (
      <>
        <Skeleton width="100%" height={48} />
        <Skeleton width="40%" height={12} />
      </>
    ) : shape === 'chart' ? (
      <Skeleton width="100%" height={120} />
    ) : (
      <>
        <Skeleton width="100%" height={14} />
        <Skeleton width="92%" height={14} />
        <Skeleton width="97%" height={14} />
      </>
    )}
  </div>
) : …}
```

CSS module (`widget-chrome.module.css`) adds `.shapeList`, `.shapeStat`, `.shapeChart`, `.shapeRows`, `.listRow` (flex, gap 8px), `.listLines` (flex column, flex 1).

`PageView.tsx` `WidgetSkeleton`:

```tsx
function WidgetSkeleton({ widget }: { widget: SkeletonWidget }) {
  return (
    <WidgetChrome
      title={widgetTitle(widget)}
      hideHeader={widget['hide-header'] === true}
      isLoading
      skeletonShape={SKELETON_SHAPE[widget.type ?? ''] ?? 'rows'}
    />
  );
}
```

Same one-line addition in the two inline `WidgetChrome isLoading` fallbacks in `WidgetSlot` (pass from `widget.config.type`).

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/client/components/WidgetChrome.test.tsx src/client/pages`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets/preferredSizes.ts src/client/components/WidgetChrome.tsx src/client/components/widget-chrome.module.css src/client/components/WidgetChrome.test.tsx src/client/pages/PageView.tsx
git commit -m "feat: type-shaped skeletons per widget group (list/stat/chart/rows)"
```

---

### Task 3: Server cache warm-up at boot

**Files:**
- Create: `src/server/warmup.ts`
- Modify: `src/server/index.ts` (call after config init)
- Test: `src/server/warmup.test.ts`

**Interfaces:**
- Consumes: `buildPagePayload(page, ctx)` from `./api`; `ctx` (WidgetFetchContext with real TtlCache+Singleflight) already built in `index.ts`; `getConfig()` from server config.
- Produces: `warmCache(): Promise<void>` — builds every configured page through the normal cache path so subsequent requests hit warm TTL entries. Idempotent, all-settled (one failing widget/page must not reject), re-invocable on config reload.

Homarr-pattern: server-side background cron warms caches so page open never triggers cold upstream fetches (research REPORT §1).

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, buildPagePayload: vi.fn(async (_p: unknown, ctx: unknown) => { void ctx; }) };
});

import { warmCache } from './warmup';

const okConfig = { ok: true as const, errors: [], config: {
  pages: [
    { name: 'A', slug: 'a', columns: [{ size: 'full', widgets: [{ type: 'clock' }] }] },
    { name: 'B', slug: 'b', columns: [{ size: 'full', widgets: [{ type: 'clock' }] }] },
  ],
} };

it('builds every page once', async () => {
  vi.mock('./config', () => ({ getConfig: () => okConfig }));
  const { buildPagePayload } = await import('./api');
  await warmCache();
  expect(buildPagePayload).toHaveBeenCalledTimes(2);
});

it('never rejects when a page build fails', async () => {
  vi.mocked((await import('./api')).buildPagePayload)
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce({} as never);
  await expect(warmCache()).resolves.toBeUndefined();
});
```

(Adjust mock wiring to the actual module layout — `getConfig` import may need `vi.doMock` ordering; keep zero network by mocking `buildPagePayload`.)

- [ ] **Step 2: Verify FAIL** — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
import { buildPagePayload } from './api';
import { getConfig } from './config';
import { ctx } from './index'; // or wherever the shared WidgetFetchContext lives — export it if private

/** Warm every page through the normal cache path (singleflight dedupes,
 * TTL fills) so first visitor never eats cold upstream latency. */
export async function warmCache(): Promise<void> {
  const r = getConfig();
  if (!r.ok || !r.config) return;
  await Promise.allSettled(
    r.config.pages.map((page) => buildPagePayload(page as typeof page & { slug: string }, ctx)),
  );
}
```

If `ctx` isn't exported from `index.ts`, export it there (it's already constructed for route handlers).

In `index.ts`, after successful config init:

```ts
void warmCache().catch(() => {}); // fire-and-forget boot warm-up
```

and inside the config-watch reload callback (same fire-and-forget) so edited configs re-warm.

- [ ] **Step 4: Run tests** — `bunx vitest run src/server/warmup.test.ts` PASS.

- [ ] **Step 5: Smoke** — restart prod server (`hub restart glimpse-prod`), immediately curl `GET /api/page/home` twice; second response should contain populated payloads without waiting on upstreams (verify via timing: second call < first).

- [ ] **Step 6: Commit**

```bash
git add src/server/warmup.ts src/server/warmup.test.ts src/server/index.ts
git commit -m "feat: warm server widget cache at boot and on config reload"
```

---

### Task 4: Suppress skeleton flash (<300ms loads show nothing)

**Files:**
- Modify: `src/client/pages/PageView.tsx` (`PageSkeleton` usage site ~line 524)
- Test: `src/client/pages/PageView.test.tsx`

**Interfaces:**
- Consumes: `data` null-ness from `usePageData`.
- Produces: `DelayedSkeleton` local component — renders children (skeleton) only after 250ms mounted; unmount-cancelled timer.

NNG/Primer rule: `<1s` waits should show no indicator; a flash makes it feel slower (REPORT §3).

- [ ] **Step 1: Failing test**

```ts
it('does not render skeleton before 250ms', async () => {
  vi.useFakeTimers();
  render(<PageSkeletonGate page={page} ready={false} />);
  expect(screen.queryByTestId('page-skeleton')).toBeNull();
  act(() => { vi.advanceTimersByTime(260); });
  expect(screen.getByTestId('page-skeleton')).toBeTruthy();
  vi.useRealTimers();
});
```

(`PageSkeletonGate` = the extracted wrapper below.)

- [ ] **Step 2: Implement**

In `PageView.tsx`:

```tsx
function DelayedSkeleton({ delay = 250, children }: { delay?: number; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return show ? <>{children}</> : null;
}
```

Replace `if (page) return <PageSkeleton page={page} />;` with:

```tsx
if (page)
  return (
    <DelayedSkeleton>
      <PageSkeleton page={page} />
    </DelayedSkeleton>
  );
```

- [ ] **Step 3: Tests PASS** — run `bunx vitest run src/client/pages`.

- [ ] **Step 4: Commit**

```bash
git add src/client/pages/PageView.tsx src/client/pages/PageView.test.tsx
git commit -m "feat: delay page skeleton 250ms to avoid flash on fast loads"
```

---

### Task 5: Integration pass

- [ ] **Step 1:** `bunx tsc --noEmit` — clean.
- [ ] **Step 2:** `bun run test` — all green (~510+).
- [ ] **Step 3:** `npx react-doctor@latest` — full scan 100/100.
- [ ] **Step 4:** Browser smoke via headless Chromium: cold-load Home — verify (a) skeleton appears layout-matched with typed silhouettes, (b) widgets pop in individually (DevTools network throttling optional), (c) tab switch to Dev and back shows instant cached render, (d) explicit reload shows skeletons again.
- [ ] **Step 5:** Final report to user with evidence.
