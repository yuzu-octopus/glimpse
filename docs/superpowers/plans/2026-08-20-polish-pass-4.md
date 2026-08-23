# Polish Pass 4 — Releases, Star, Videos, Placeholders, Refresh & YouTube Limits Implementation Plan — EXECUTED

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish polish: releases collapsed arrow-only, star icon parity, clarify video style configurability, add backend placeholders, set sensible auto vs reload-only refresh defaults, guarantee YouTube flawless under limits.

**Architecture:** Server keeps per-widget `TtlCache` + `Singleflight` with `parseCacheDuration` (default 5m). Client `usePageData` polls `GET /api/page/:slug`. New split: `LIVE` widgets (clock, weather, markets, monitor) short TTL + client poll 30s, `STATIC` widgets (rss, releases, repository, videos, custom-api, hacker-news, lobsters, reddit, twitch, bookmarks, todo, calendar, iframe) long TTL 1h + reload-only (no poll). YouTube fetcher: `channel_id` feed with `Mozilla/5.0` UA, `Promise.allSettled` 30 workers, `ctx.cache` 1h per-feed stale fallback.

**Tech Stack:** Bun + TypeScript + React 19 + Vite + Astryx + zod v4 + Vitest + Playwright, `Bun.fetch` with `User-Agent`

## Global Constraints

- Flat glance: 1px solid var(--color-widget-content-border), radius 5px, JetBrains Mono, no shadows — one line.
- Data-driven: no hardcoded YT maps; config UC IDs, runtime handle→UC via youtube.com/@handle + regex.
- TDD red→green, `bunx tsc --noEmit` + `bun run test` green, `npx react-doctor@latest --verbose` 100.
- Batch toolcalls/writes/edits; web_search when unsure (youtube limits, polling defaults).

---

### Task 1: Releases — collapsed by default, arrow-only

**Files:**
- Modify: `src/client/widgets/releases/index.tsx:17-150`
- Modify: `src/client/widgets/releases/releases.module.css:19-90`
- Test: `src/client/widgets/releases/releases.test.tsx`

**Interfaces:**
- Consumes: `Release { name, tag, url, published, source, notes?: string|null }`
- Produces: `ReleaseRow` collapsed (open=false), arrow button only

- [ ] **Step 1: Write failing test — collapsed**

```tsx
test('release collapsed by default, no Show more text', () => {
  render(<Releases config={{repositories:['a/b']}} data={{releases:[{name:'v1',tag:'v1',url:'#',published:null,source:'github',notes:'## Notes\nfix'}]}} />);
  expect(screen.queryByText(/Notes/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Show release notes/)).toHaveAttribute('aria-expanded','false');
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/widgets/releases/releases.test.tsx -v`
Expected: FAIL (currently first item defaultExpanded true, has Show more)

- [ ] **Step 3: Implement minimal**

```tsx
// Remove defaultExpanded prop, const [open]=useState(false)
// Remove <button>Show more/less</button> and isLong/preview logic, keep only arrow ChevronDown
// Remove defaultExpanded={i===0} in Releases items map
// Keep hasNotes && open ? <pre.notes>{notes}</pre> : null
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/widgets/releases -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/widgets/releases/* 
git commit -m "fix: releases collapsed arrow-only"
```

---

### Task 2: Star icon parity

**Files:**
- Modify: `src/client/widgets/custom-api/index.tsx:8-32`
- Modify: `src/client/widgets/custom-api/custom-api.module.css`
- Test: `src/client/widgets/custom-api/custom-api.test.tsx`

**Interfaces:**
- Consumes: `CustomApiItem { title, value }`
- Produces: `ItemRow` with `<Star data-testid="custom-api-star">` when `/star/i.test(title)`

- [ ] **Step 1: Write failing test**

```tsx
test('stargazers shows star icon', () => {
  render(<CustomApi config={{url:'https://api.github.com/repos/a/b'}} data={{items:[{title:'Stargazers', value:'36462'}]}} />);
  expect(screen.getByTestId('custom-api-star')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/widgets/custom-api -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
import { Star } from 'lucide-react';
{ /star/i.test(item.title) && <Star size={14} data-testid="custom-api-star" className={styles.starIcon} /> }
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/widgets/custom-api -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/widgets/custom-api/*
git commit -m "feat: star icon parity"
```

---

### Task 3: Video configurability doc + placeholder

**Files:**
- Modify: `src/client/widgets/videos/index.tsx:34-84`
- Modify: `src/client/widgets/videos/videos.module.css`
- Test: `src/client/widgets/videos/videos.test.tsx`

**Interfaces:**
- Consumes: `videosSchema style: 'horizontal-cards'|'vertical-list'|'grid-cards'`
- Produces: `WidgetChrome` loading skeleton, empty placeholder, style maps to CSS

- [ ] **Step 1: Write failing test**

```tsx
test('videos empty shows placeholder', () => {
  render(<Videos config={{channels:['UCx']}} data={{videos:[]}} />);
  expect(screen.getByText(/No videos/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/widgets/videos -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
if (isLoading) return <WidgetChrome isLoading ... />
if (error) return <WidgetChrome error ... />
if (videos.length===0) return <WidgetChrome><div className={styles.placeholder}>No videos — check channels</div></WidgetChrome>
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/widgets/videos -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/widgets/videos/* config.example.yml
git commit -m "fix: videos placeholder + style docs"
```

---

### Task 4: Placeholders for backend-dependent widgets

**Files:**
- Modify: `src/client/pages/PageView.tsx` (WidgetChrome isLoading wiring)
- Modify: `src/client/widgets/rss/index.tsx`, `src/client/widgets/reddit/index.tsx`, `src/client/widgets/lobsters/index.tsx`, `src/client/widgets/hacker-news/index.tsx`
- Test: `src/client/pages/PageView.test.tsx`

**Interfaces:**
- Consumes: `WidgetPayload { data, error, config }` with `data===null` during fetch
- Produces: `WidgetChrome isLoading` skeleton when `data===null && !error`

- [ ] **Step 1: Write failing test**

```tsx
test('rss shows skeleton while loading', () => {
  render(<PageView page={pageWithRss} />); // mock usePageData returns {data:null}
  expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v`
Expected: FAIL (currently shows error/empty)

- [ ] **Step 3: Implement**

```tsx
// PageView fetches via usePageData, passes isLoading = !data && !error to WidgetChrome
// Ensure each widget forwards isLoading to WidgetChrome
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/PageView.tsx src/client/widgets/rss/* ...
git commit -m "fix: backend placeholders"
```

---

### Task 5: Sensible refresh defaults

**Files:**
- Modify: `src/server/cache.ts` (LIVE_TYPES, getDefaultTtl)
- Modify: `src/server/api.ts` (use getDefaultTtl)
- Modify: `src/client/hooks/usePageData.ts` (poll only LIVE)
- Test: `src/server/api.test.ts`

**Interfaces:**
- Consumes: `widget.type`
- Produces: `getDefaultTtl(type) => 60_000 LIVE else 3_600_000 STATIC`

- [ ] **Step 1: Write failing test**

```tsx
test('live vs static TTL', () => {
  expect(getDefaultTtl('weather')).toBe(60_000);
  expect(getDefaultTtl('rss')).toBe(3_600_000);
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/server/api.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export const LIVE_TYPES = new Set(['clock','weather','markets','monitor']);
export function getDefaultTtl(type:string){ return LIVE_TYPES.has(type)?60_000:3600_000 }
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/server -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/cache.ts src/server/api.ts src/client/hooks/usePageData.ts
git commit -m "feat: live vs reload-only TTL"
```

---

### Task 6: YouTube flawless (web_search, rate limits)

**Files:**
- Modify: `src/server/widgets/videos.ts`
- Test: `src/server/widgets/videos.test.ts`

**Interfaces:**
- Consumes: `ctx.cache`, `videosSchema`
- Produces: `feedUrlForId` channel_id, handle cache, 1h stale fallback

- [ ] **Step 1: web_search**

Run: `web_search --query "youtube rss feed rate limit 429 channel_id"` + `web_search --query "youtube feed videos.xml playlist_id UULF"`
Expected: confirm need Mozilla UA, channel_id more reliable than UULF, 429 requires backoff

- [ ] **Step 2: Write failing test**

```tsx
test('429 returns cached stale', async () => {
  ctx.cache.set('videos:feed:UCx', [{title:'cached'}], 3600_000);
  mockFetch.mockResolvedValue(new Response('',{status:429}));
  const data = await fetcher(ctx,{channels:['UCx']});
  expect(data.videos[0].title).toBe('cached');
});
```

- [ ] **Step 3: Implement**

```ts
// fetchText with YT_UA, try/catch returns cached if exists, Promise.allSettled merging
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/server/widgets/videos.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/widgets/videos.ts
git commit -m "fix: youtube rate-limit fallback"
```

---

