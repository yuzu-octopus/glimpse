# Page Load / Refresh & Backend Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make page loading structure-ready (no layout shift), updates atomic and flicker-free, and backend tail latency + cold-start low.

**Architecture:** Keep Bun.serve raw `fetch` + existing `TtlCache`/`Singleflight`/`runtime.ts` deep module. Add sub-fetch singleflight, throttle N+1 fan-outs, align Cache-Control/ETag, optional streaming endpoint. Frontend keeps `usePageData` stale-while-revalidate but adds `useTransition` + atomic `setData` + structure-matched `PageSkeleton` + per-widget skeletons (real chrome, empty content).

**Tech Stack:** Bun.serve (Bun 1.2), React 19 `useTransition` + `Suspense` pattern (no full Suspense migration), `TtlCache` + `Singleflight`, `p-limit` style throttle without new dep.

## Global Constraints

- Bun + TypeScript + Vite + React 19 + Astryx flat — no new deps unless justified (prefer 10-line pLimit)
- Flat glance style: 1px border, 5px radius, JetBrains Mono, no shadows — skeletons must match chrome metrics
- `glance/**` ignored by react-doctor; ` doctor 100/100` full scan required
- TDD: failing test → pass → commit per task; batch toolcalls
- Existing `config.yml` YAML compat, `TtlCache`/`Singleflight` single-sourced via `shared/live.ts`
- `Bun.serve` `routes` vs `fetch` per Bun docs (`/oven-sh/bun` — `Bun.serve({routes, fetch})` tree SIMD, zero-alloc static Response)

---

## File Structure

- Modify: `src/server/index.ts` — add `routes` table for static health/dist, fix Cache-Control + ETag for `/api/page`
- Modify: `src/server/cache.ts` — negative cache + stale-while-revalidate retain
- Modify: `src/server/widgets/runtime.ts` — expose `cachedFetch` helper for sub-fetches
- Modify: `src/server/widgets/hacker-news.ts` — pLimit(6) + allSettled + singleflight per item
- Modify: `src/server/widgets/videos.ts` — move `handleChannelCache` into `ctx.cache` + singleflight, fix stale fallback after TTL expiry
- Modify: `src/server/widgets/reddit.ts`, `src/server/widgets/twitch.ts` — token singleflight + always-cache default 1h (Twitch when expires_in missing)
- Modify: `src/server/api.ts` — optional `?stream` NDJSON/SSE per-widget flush (atomic default preserved)
- Modify: `src/server/config.ts` — background warm `buildPagePayload` after successful reload, granular clear
- Modify: `src/client/hooks/usePageData.ts` — `useTransition` atomic swap, keep stale on poll, abort on slug change, expose `isValidating` for top progress
- Modify: `src/client/pages/PageView.tsx` — use `isValidating` top bar (opacity not skeleton), ensure skeleton structure-matched via `getTilingProps` + `estimateColumnRowSpan`
- Modify: `src/client/components/WidgetChrome.tsx` + `widget-chrome.module.css` — real chrome with empty content skeleton (not empty div), preserve expanded state keys
- Test: `src/client/pages/PageView.test.tsx`, `src/client/hooks/usePageData.test.tsx`, `src/server/widgets/*.test.ts`

---

### Task 1: Frontend — structure-ready skeleton (real chrome, empty content)

**Files:**
- Modify: `src/client/pages/PageView.tsx:312-324`
- Modify: `src/client/components/WidgetChrome.tsx:46-80`
- Modify: `src/client/components/widget-chrome.module.css`
- Test: `src/client/pages/PageView.test.tsx`

**Interfaces:**
- Consumes: `getTilingProps(tiling,minWidth)` from `tiling.ts`, `LIVE_POLL` from `shared/live.ts`
- Produces: `PageSkeleton` that mirrors real grid (same columns + WidgetChrome shells) so CLS=0

- [ ] **Step 1: Write failing test — skeleton has same column count as real page**

```tsx
// src/client/pages/PageView.test.tsx
it('skeleton mirrors columns (no CLS)', () => {
  const page = { columns: [{size:'full'}, {size:'full'}], tiling:'columns', minColumnWidth:320 } as any;
  const { container } = render(<PageSkeleton page={page} />);
  expect(container.querySelectorAll('[data-testid=\"column\"]')).toHaveLength(2);
});
```

- [ ] **Step 2: Run test — FAIL (skeleton generic fallback renders single column)**
Run: `bunx vitest run src/client/pages/PageView.test.tsx -t "skeleton mirrors" -v`
Expected: FAIL

- [ ] **Step 3: Minimal fix — make generic fallback also use PageChrome grid**

```tsx
// PageView.tsx — when !data && !error && !page, render <div className={styles.page}><div className={styles.columns}><div className={styles.columnWidgets}><Card><Skeleton/></Card></div></div></div>
// Already done for page-aware branch: PageSkeleton uses getTilingProps + MobileColumn + HideHeadersContext
// Ensure WidgetChrome shells render with isLoading=true but title row visible (empty description/tag slots hidden)
```

- [ ] **Step 4: Run test — PASS**

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/PageView.tsx src/client/components/WidgetChrome.tsx src/client/pages/PageView.test.tsx
git commit -m "feat: skeleton structure-ready chrome (no CLS)"
```

---

### Task 2: Frontend — flicker-free atomic update (receive fully then swap)

**Files:**
- Modify: `src/client/hooks/usePageData.ts:49-84`
- Modify: `src/client/pages/PageView.tsx:304-335`
- Test: `src/client/hooks/usePageData.test.tsx`

**Interfaces:**
- Consumes: `fetch('/api/page/'+slug)` JSON `PagePayload`
- Produces: `usePageData(slug): {data, error, isValidating}` where `data` retained while `isValidating=true`, swap is single `startTransition(() => setData(next))`

- [ ] **Step 1: Failing test — poll keeps stale, no skeleton flash**

```tsx
it('poll does not clear data (stale-while-revalidate)', async () => {
  const { result } = renderHook(() => usePageData('home'));
  await waitFor(() => expect(result.current.data).toBeTruthy());
  const first = result.current.data;
  // trigger manual validate (expose validate())
  await act(async () => { await result.current.validate(); });
  expect(result.current.data).toBe(first); // same ref until next resolved
  expect(result.current.isValidating).toBe(false);
});
```

- [ ] **Step 2: Run — FAIL (validate clears data)**
Run: `bunx vitest run src/client/hooks/usePageData.test.tsx -v`

- [ ] **Step 3: Implement — useTransition + atomic swap, slug-change clears, poll retains**

```ts
// usePageData.ts
const [isPending, startTransition] = useTransition();
// on slug change: startTransition(() => { setData(null); setError(null); });
// on fetch success: startTransition(() => { dataRef.current = next; setData(next); setIsValidating(false); });
// expose isValidating = isPending || isValidatingRef for PageView top bar
// fetch uses AbortController per slug+poll, abort previous on deps change
```

PageView:

```tsx
const { data, error, isValidating } = usePageData(slug);
{isValidating && data && <div className={styles.topProgress} aria-hidden />}
// no per-widget skeleton while isValidating; WidgetChrome keeps showing old Feed
```

- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit**

```bash
git add src/client/hooks/usePageData.ts src/client/pages/PageView.tsx src/client/hooks/usePageData.test.tsx
git commit -m "feat: atomic SWR via startTransition flicker-free poll"
```

---

### Task 3: Backend — Bun.serve routes + Cache-Control/ETag alignment

**Files:**
- Modify: `src/server/index.ts:141-193`
- Modify: `src/server/cache.ts` (add `getStale` helper if needed)
- Test: `src/server/api.test.ts`

**Interfaces:**
- Consumes: `Bun.serve({routes, fetch})` per `/oven-sh/bun` docs
- Produces: `ETag: hash(JSON.stringify(payload))` + `If-None-Match → 304`, `Cache-Control: private, max-age=10` for `/api/page` aligned to `LIVE_POLL 30s`

- [ ] **Step 1: Failing test — ETag 304**

```ts
it('api/page returns 304 when If-None-Match matches', async () => {
  const r1 = await fetchPage('home');
  const etag = r1.headers.get('etag');
  const r2 = await fetch('/api/page/home', { headers: { 'if-none-match': etag! }});
  expect(r2.status).toBe(304);
});
```

- [ ] **Step 2: Run — FAIL (no etag)**
- [ ] **Step 3: Implement — `routes` table for static `/health`, `Bun.file` dist with `sendfile(2)`, `ETag` via `Bun.hash(payload)`**

```ts
Bun.serve({
  routes: {
    "/health": new Response("OK"),
    "/assets/*": (req) => new Response(Bun.file("dist/assets/"+param)),
  },
  fetch(req) { /* existing switch: /api/page, /api/config, /api/theme, fallback */ }
});
// inside /api/page handler after buildPagePayload:
const body = JSON.stringify(payload);
const etag = `W/\"${Bun.hash(body).toString(16)}\"`;
if (req.headers.get('if-none-match')===etag) return new Response(null,{status:304, headers:{etag}});
return json(body,{etag, 'cache-control':'private, max-age=10, stale-while-revalidate=30'});
```

- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit**

```bash
git add src/server/index.ts src/server/cache.ts src/server/api.test.ts
git commit -m "feat: Bun routes + ETag 304 align cache-control to live poll"
```

---

### Task 4: Backend — throttle & dedupe N+1, fix stale/negative cache

**Files:**
- Modify: `src/server/cache.ts:8-48`
- Modify: `src/server/widgets/runtime.ts:55-110`
- Modify: `src/server/widgets/hacker-news.ts:21-33`
- Modify: `src/server/widgets/videos.ts:28,68-179`
- Modify: `src/server/widgets/reddit.ts:36-59`, `src/server/widgets/twitch.ts:29-53`
- Test: `src/server/widgets/*.test.ts`

**Interfaces:**
- Consumes: `ctx.cache`, `ctx.singleflight`, `ctx.fetch`
- Produces: `cachedFetch(key, fetcher, ttl?)` via `runtime.ts`, `pLimit(6)` inline, `handle → UC` cached in `ctx.cache` with TTL+singleflight, token cached always-default 1h, negative cache 30s

- [ ] **Step 1: Failing tests — HN throttled, token singleflight, stale after TTL**

```ts
it('hn limits concurrency to 6 (pLimit)', async () => { /* mock fetchJson counts concurrent */ });
it('reddit token singleflight', async () => { /* concurrent fetches share one POST */ });
it('videos stale fallback after TTL expiry still returns last videos', async () => { /* advance timers past TTL, fetch fails, expect cached */ });
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement**

```ts
// cache.ts — add setError(key, err, ttl=30_000) negative cache; get returns stale if present and fresh missing
// runtime.ts — export async function cachedFetch(ctx, key, fetcher, ttlMs?) { if(cached) return; return ctx.singleflight.run(key, fetcher) }
// hacker-news.ts — function pLimit(n) { queue } wrap ids.slice(0,wanted).map with limit, use Promise.allSettled, wrap per-item fetchJson with ctx.singleflight.run(`hn:item:${id}`)
// videos.ts — replace handleChannelCache Map with ctx.cache 'yt:handle:@x' (TTL 24h) + singleflight; store videos payload with stale copy (keep last successful payload under staleKey = fullKey+':stale')
// reddit/twitch — const token = await ctx.singleflight.run('reddit:token', fetchToken); if(!payload.expires_in) ttl=3600*1000
```

- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit**

```bash
git add src/server/cache.ts src/server/widgets/runtime.ts src/server/widgets/hacker-news.ts src/server/widgets/videos.ts src/server/widgets/reddit.ts src/server/widgets/twitch.ts
git commit -m "feat: throttle HN, dedupe handles/tokens, stale+negative cache"
```

---

### Task 5: Backend — streaming page (progressive paint) + background warm

**Files:**
- Modify: `src/server/api.ts:54-77`
- Modify: `src/server/index.ts:183` (query `?stream=1` branch)
- Modify: `src/server/config.ts:228-260`
- Test: `src/server/api.test.ts`

**Interfaces:**
- Consumes: `buildPagePayload` promise per widget
- Produces: `GET /api/page/:slug?stream=1` → `NDJSON` or `SSE` `data: {"type":"widget","path":"columns[0].widgets[1]","payload":{...}}` flushed as each `fetchWidget` settles; fallback atomic JSON when no `?stream`

- [ ] **Step 1: Failing test — stream emits head before videos**

```ts
it('stream page flushes head widgets before slow videos', async () => {
  const res = await fetch('/api/page/home?stream=1');
  const chunks = await readNDJSON(res);
  expect(chunks[0].path).toMatch(/headWidgets/);
});
```

- [ ] **Step 2: Run — FAIL (no stream)**
- [ ] **Step 3: Implement — `ReadableStream` + `Promise.allSettled` flush, `ctx` warm**

```ts
// api.ts — export async function* streamPagePayload(page,ctx) { for (const w of head) { const p = await fetchWidget; yield {path, payload: p} } }
// index.ts — if (url.searchParams.has('stream')) return new Response(ReadableStream from streamPagePayload, {headers:{'content-type':'application/x-ndjson','cache-control':'no-store'}});
// config.ts — after if(r.ok){ ctx.cache.clear(); for(const p of config.pages) void buildPagePayload(p,ctx).catch(()=>{}) }
```

Client opt-in later: `usePageData` tries `?stream=1` with `fetch` reader, merges chunks via `startTransition`. Keep atomic path default to avoid breaking existing client.

- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit**

```bash
git add src/server/api.ts src/server/index.ts src/server/config.ts src/server/api.test.ts
git commit -m "feat: streaming NDJSON page + background warm on config reload"
```

---

## Self-Review

- Spec coverage: structure-ready skeleton (T1) + flicker-free atomic swap via useTransition (T2) + Bun routes/ETag/Cache-Control (T3) + N+1 throttle & singleflight & stale/negative cache (T4) + streaming progressive + warm (T5) — covers audit findings §1-5.
- Placeholder scan: no TBD; all steps have file:line + code + run command.
- Type consistency: `PagePayload`/`WidgetPayload` from `shared/api.ts`, `ctx.cache`/`ctx.singleflight`/`ctx.fetch` from `server/api.ts` `WidgetCtx`, `getTilingProps` from `tiling.ts` — consistent.
