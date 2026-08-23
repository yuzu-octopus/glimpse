# Big Refactor — Spacing, Feed Tree, YouTube Handle, Limit 5, Search Compact, Bangs Implementation Plan — EXECUTED

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify spacing via global vars (23px gap, 15px inset, uniform 15/17 inner), introduce Feed base tree (raw flexible → premade wrappers, releases custom), make YouTube @handle primary (server resolves), default limit 5 for all feeds, compact 36-40px search, and bangs docs from helium.computer — flat glance, data-driven, TDD.

**Architecture:** `glimpseTheme.ts` `DIMS` holds `--space-gap 23px` + `--space-viewport 15px` + `--widget-content-vertical 15px`/`--widget-content-horizontal 17px` (uniform inner) — `page.module.css`/`app.module.css`/`widget-chrome`/`Feed` consume them, header separate `45px` below is `page` start. `Feed` (`src/client/widgets/feed/Feed.tsx`) is deep module: props `items: FeedItem[]` (title/url/meta/tags/image) + `layout: list|grid|row` + `xstyle` granular, wrappers (`rss`/`hn`/`lobsters`/`reddit`/`videos vertical`) map domain payloads → `FeedItem`. YouTube server `videos.ts` already resolves `@handle` → `UC` via `youtube.com/@handle` regex + `handleChannelCache` 1h, `feedUrlForId` always `channel_id`, `Mozilla UA`, `Promise.allSettled`. Defaults: `shared/widgets/*` `limit` `z.number().int().min(0).default(5)`; search `TextInput` compact; bangs from `helium.computer` copied to `shared/widgets/bangs.ts` (~30) + `SettingsPanel` Docs→Shebang.

**Tech Stack:** Bun + TypeScript + React 19 + Vite + Astryx + StyleX + zod v4 + Vitest, `Bun.fetch`

## Global Constraints

- Flat glance: 1px solid var(--color-widget-content-border), radius 5px, JetBrains Mono, no shadows.
- Data-driven: config holds @handle or UC, no code maps; limit via YAML, default 5.
- Desktop colours accurate to theme files (dracula), mobile after.
- TDD red→green, `bunx tsc --noEmit` + `bun run test` green, `react-doctor 100`.
- Batch toolcalls/writes/edits; web_search when unsure (helium bangs, youtube handle).

---

### Task 1: Spacing — global vars uniform

**Files:**
- Modify: `src/shared/theme/glimpseTheme.ts:144-159` (DIMS)
- Modify: `src/index.css:18-30` (fallbacks)
- Modify: `src/client/pages/page.module.css:3-16` (page padding)
- Modify: `src/client/components/widget-chrome.module.css:5-16` (body padding)
- Modify: `src/client/widgets/feed/Feed.module.css` (gap)
- Test: `src/client/pages/PageView.test.tsx`

**Interfaces:**
- Consumes: `--space-gap`, `--space-viewport`, `--widget-content-vertical/horizontal`
- Produces: uniform spacing

- [ ] **Step 1: Write failing test — uniform gap**

```tsx
test('global spacing vars exist', () => {
  const css = readFileSync('src/index.css','utf8');
  expect(css).toContain('--space-gap');
  expect(css).toContain('--widget-content-vertical');
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v`
Expected: FAIL (no vars yet)

- [ ] **Step 3: Implement minimal**

```ts
// glimpseTheme.ts DIMS: '--space-gap':'23px', '--space-viewport':'15px', '--widget-content-vertical':'15px', '--widget-content-horizontal':'17px'
// index.css :root fallbacks same
// page.module.css .page {padding-block: var(--space-gap); padding-inline: var(--space-viewport)}
// widget-chrome .body {padding: var(--widget-content-vertical) var(--widget-content-horizontal)}
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/theme/glimpseTheme.ts src/index.css src/client/pages/page.module.css
git commit -m "feat: global spacing vars uniform"
```

---

### Task 2: Feed tree — raw flexible → premade (releases custom)

**Files:**
- Create: `src/client/widgets/feed/Feed.tsx` (already exists, enhance xstyle)
- Modify: `src/client/widgets/rss/index.tsx`, `src/client/widgets/hacker-news/index.tsx`, `src/client/widgets/lobsters/index.tsx`, `src/client/widgets/reddit/index.tsx`, `src/client/widgets/videos/index.tsx` (vertical)
- Test: `src/client/widgets/feed/Feed.test.tsx`

**Interfaces:**
- Consumes: `FeedItem {title,url,meta?,tags?,image?}`
- Produces: `Feed` renders with `xstyle` granular, wrappers map domain → FeedItem

- [ ] **Step 1: Write failing test — wrappers use Feed**

```tsx
test('rss uses Feed', () => {
  const src = readFileSync('src/client/widgets/rss/index.tsx','utf8');
  expect(src).toContain("from '../feed/Feed'");
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/widgets/rss -v`
Expected: FAIL if not yet

- [ ] **Step 3: Implement**

```tsx
// Keep releases custom (notes expand) — not via Feed, but limit 5 still
// For rss/hn/lobsters/reddit/vertical videos: import Feed, map to FeedItem, <Feed items={mapped} layout="list" />
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/widgets -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/widgets/feed src/client/widgets/rss src/client/widgets/hacker-news
git commit -m "feat: feed tree raw → premade"
```

---

### Task 3: YouTube @handle primary

**Files:**
- Modify: `src/server/widgets/videos.ts:23-40` (already does, keep)
- Modify: `config.example.yml:119-126` (examples to @handle primary)
- Test: `src/server/widgets/videos.test.ts`

**Interfaces:**
- Consumes: `videosSchema channels: string[]` (UC or @handle)
- Produces: `feedUrlsForChannels` resolves @handle → UC

- [ ] **Step 1: Write failing test — @handle resolves**

```tsx
test('@spokeishere resolves', async () => {
  const url = await feedUrlsForChannels(mockCtx, ['@SpokeIsHere'], false);
  expect(url[0].url).toContain('channel_id=UCk2ux');
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/server/widgets/videos.test.ts -v`
Expected: PASS (already), if fail fix

- [ ] **Step 3: Implement — update config examples to @handle primary**

```yaml
channels:
  - "@Fireship"
  - "@ByCloud"
  - "@Bug-I"
  - "@CalebWritesCode"
  - "@AZisk"
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/server/widgets/videos.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config.example.yml src/server/widgets/videos.ts
git commit -m "feat: youtube @handle primary easy config"
```

---

### Task 4: Limit 5 default for all feeds

**Files:**
- Modify: `src/shared/widgets/feeds.ts`, `src/shared/widgets/keyed.ts` (videos, lobsters, etc), `src/shared/widgets/shared.ts`
- Test: `src/server/widgets/*test.ts`

**Interfaces:**
- Consumes: `z.number().default(5)`
- Produces: `cfg.limit ?? 5` for rss/hn/lobsters/reddit/videos/releases/repository/twitch

- [ ] **Step 1: Write failing test — default 5**

```tsx
test('rss default limit 5', () => {
  expect(rssSchema.parse({type:'rss', feeds:[]}).limit).toBe(5);
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/shared/widgets -v`
Expected: FAIL (currently 10)

- [ ] **Step 3: Implement**

```ts
// shared/widgets: limit: z.number().int().min(0).default(5)
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/server/widgets -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets
git commit -m "feat: default limit 5 for feeds"
```

---

### Task 5: Search compact 36-40px

**Files:**
- Modify: `src/client/widgets/search/index.tsx`, `src/client/widgets/search/search.module.css`
- Test: `src/client/widgets/search/search.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: search input height 36-40px with magnifying glass

- [ ] **Step 1: Write failing test — height**

```tsx
test('search compact height', () => {
  const css = readFileSync('search.module.css','utf8');
  expect(css).toMatch(/height:\s*(36|38|40)px/);
});
```

- [ ] **Step 2: Run test**

Run: `bunx vitest run src/client/widgets/search -v`
Expected: FAIL

- [ ] **Step 3: Implement**

```css
.search { height: 38px; padding: 6px 10px; display:flex; align-items:center; gap:8px; }
.searchIcon { width:16px; height:16px; }
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/client/widgets/search -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/widgets/search
git commit -m "fix: search compact 38px"
```

---

### Task 6: Bangs from helium.computer + docs

**Files:**
- Create: `src/shared/widgets/bangs.ts` (copy ~30 from helium.computer)
- Modify: `src/client/widgets/search/index.tsx` (use bangs list)
- Modify: `src/client/components/SettingsPanel.tsx` (Docs → Shebang)
- Test: `src/shared/widgets/bangs.test.ts`

**Interfaces:**
- Consumes: `bangs: {title, shortcut, url}` from helium
- Produces: Settings docs shebang section

- [ ] **Step 1: web_search helium bangs**

Run: `web_search --query "helium.computer bangs list"`

- [ ] **Step 2: Write failing test — bangs count**

```tsx
test('helium bangs copied', () => {
  expect(bangs.length).toBeGreaterThan(20);
  expect(bangs.find(b=>b.shortcut==='gh')).toBeTruthy();
});
```

- [ ] **Step 3: Implement**

```ts
// bangs.ts export const bangs = [{title:'GitHub', shortcut:'gh', url:'https://github.com/search?q={QUERY}'}, ... helium list]
// SettingsPanel: add Docs tab with Shebang section listing bangs
```

- [ ] **Step 4: Run test**

Run: `bunx vitest run src/shared/widgets/bangs.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets/bangs.ts src/client/components/SettingsPanel.tsx
git commit -m "feat: bangs from helium + docs"
```

---

## Self-Review

**Spec coverage:** Spacing ✅, Feed tree ✅, @handle ✅, Limit 5 ✅, Search compact ✅, Bangs ✅
**Placeholder scan:** No TBD.
**Type consistency:** FeedItem, limit types, bangs types match.

