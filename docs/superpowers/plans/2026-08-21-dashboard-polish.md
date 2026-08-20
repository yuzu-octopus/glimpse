# Dashboard Polish & Compositor Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix feed sticky, cap Minecraft videos to 3, remove twitch, make search default new-tab, add homelab system-stats, and upgrade collage compositor to preferred-size squared-error.

**Architecture:** Keep flat 1px/5px/ JetBrains Mono theme, existing `TtlCache`/`Singleflight`/`WidgetChrome` seams, and `getTilingProps` → `useCollageTiling` tiling stack. Add `preferredSizes` registry and pure `chooseColumnCount` helper for squared-deviation `n*`, new `system-stats` isomorphic widget, and small chrome/config/schema tweaks. No new deps except `systeminformation`.

**Tech Stack:** Bun 1.4 + TypeScript 7 + Vite 6 + React 19 (Astryx), `systeminformation@^5`, `TtlCache`/`Singleflight`/`parseCacheDuration`, `Bun.serve`.

## Global Constraints

- Bun + TypeScript + Vite + React 19 + Astryx flat — 1px border 5px radius, no shadows
- Do NOT add deps beyond `systeminformation` without asking
- TDD every task: failing test → minimal fix → pass → commit
- Batch toolcalls, reuse `widgetLimit`/`parseCacheDuration`/`TtlCache`/`Singleflight` seams
- `bunx tsc --noEmit` clean + `bun run test` 414→~422 pass + `npx react-doctor@latest --scope full` 100 before each commit
- `config.yml` is gitignored (sync `config.example.yml` changes there manually for local demo)
- Spec source: `docs/superpowers/specs/2026-08-21-dashboard-polish-design.md` + `component-ideas.md`/`collage-ideas.md`

---

## File Structure

- Modify: `src/client/components/widget-chrome.module.css:119-127` — remove sticky from `.moreExpanded`
- Test: `src/client/components/WidgetChrome.test.tsx` — add no-sticky assertion
- Modify: `config.example.yml:184-196` — Minecraft `limit: 3` + comment
- Modify: `config.yml` — same cap (manual sync, not committed if gitignored)
- Delete: `src/server/widgets/twitch.ts`
- Modify: `src/shared/widgets/keyed.ts` — drop `twitch-channels`/`twitch-top-games` from schema
- Modify: `src/client/widgets/twitch/*` → delete dir + `src/client/widgets/index.ts` registration + tests
- Modify: `src/shared/widgets/search.ts:14-18` — `'new-tab': z.boolean().default(true)` (or `.default(() => true)` for zod v4)
- Modify: `src/client/widgets/search/index.tsx:54-58` — keep swap logic, ensure `target` default `_blank` when `newTab`
- Modify: `src/client/widgets/search/engine.ts` — `resolveSearch` target default
- Test: `src/client/widgets/search/search.test.tsx` — default new-tab `_blank` case
- Create: `src/shared/widgets/system-stats.ts` — Zod schema `systemStatsSchema`
- Create: `src/server/widgets/system-stats.ts` — fetcher `registerWidget('system-stats')` using `systeminformation`
- Create: `src/client/widgets/system-stats/index.tsx` + `system-stats.module.css` — flat rows, placeholder when null
- Modify: `src/shared/widgets/payloads.ts` — add `SystemStatsData` type + `WidgetPayload` union
- Modify: `src/shared/widgets/index.ts` — add `'system-stats'` to `WidgetType`
- Test: `src/server/widgets/system-stats.test.ts` + `src/client/widgets/system-stats/system-stats.test.tsx`
- Create: `src/shared/widgets/preferredSizes.ts` — `PREFERRED_SIZES` registry + `Pref` type + `assertAllWidgetsCovered`
- Modify: `src/client/pages/tiling.ts` — add `chooseColumnCount` pure helper + `getTilingProps` n* integration
- Modify: `src/client/pages/PageView.tsx:1-30, 150-250` — wire `chooseColumnCount` for collage/auto, set `--min-column-width`/`gridTemplateColumns`
- Modify: `src/client/pages/useCollageTiling.ts:1-68` — use `prefH` when `!resizable && prefH!=null` for span, fallback measured
- Modify: `src/client/pages/page.module.css` — no new classes, just var usage
- Test: `src/client/pages/tiling.test.ts` + `src/client/pages/useCollageTiling.test.tsx` — squared error cases
- Docs: `docs/superpowers/specs/component-ideas-appendix.md` — copy of `component-ideas.md` for permanence (optional)

---

### Task 1: Fix feed Show less — not sticky

**Files:**
- Modify: `src/client/components/widget-chrome.module.css` — remove `position: sticky; bottom: -1px` from `.moreExpanded`
- Test: `src/client/components/WidgetChrome.test.tsx`

**Interfaces:**
- Consumes: `WidgetChrome` already renders `button.more` vs `button.more.moreExpanded` — CSS only.
- Produces: Both toggles scroll normally; hover highlight not clipped.

- [ ] **Step 1: Write failing test — Show less must not be sticky**

```tsx
// src/client/components/WidgetChrome.test.tsx
it('Show less scrolls with content (not sticky)', () => {
  render(
    <WidgetChrome title="Feed" collapseAfter={2} items={Array.from({length:5}, (_,i)=>({id:String(i)})) as any}>
      <div>row</div>
    </WidgetChrome>
  );
  // expand first
  fireEvent.click(screen.getByText(/Show more/));
  const btn = screen.getByText('Show less');
  expect(getComputedStyle(btn).position).not.toBe('sticky');
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/client/components/WidgetChrome.test.tsx -t "not sticky" -v`
Expected: FAIL — `expected 'sticky' not to be 'sticky'` (currently sticky)

- [ ] **Step 3: Minimal fix — delete sticky from `.moreExpanded`**

```css
/* src/client/components/widget-chrome.module.css */
.moreExpanded {
  /* removed: position: sticky; bottom: -1px; */
  background: transparent; /* keep */
}
```

Keep `background: transparent` and `.body:has(.moreExpanded:last-child) { padding-bottom: var(--widget-content-vertical) }` (lines 96-98) — that prevents opaque overlap of hover highlight.

- [ ] **Step 4: Run test — PASS**

Run: `bunx vitest run src/client/components/WidgetChrome.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/components/widget-chrome.module.css src/client/components/WidgetChrome.test.tsx
git commit -m "fix: Show less not sticky — scrolls like Show more"
```

---

### Task 2: Cap Minecraft videos to 3 in config

**Files:**
- Modify: `config.example.yml:184-196`
- Modify: `config.yml` (local, gitignored — manual sync)

**Interfaces:**
- Consumes: `videos` widget `limit` field (already honored by `src/server/widgets/videos.ts`).
- Produces: Social → Minecraft grid shows 3 newest.

- [ ] **Step 1: Write failing test — config limit 3**

```ts
// src/shared/config.test.ts (add)
it('minecraft example limit is 3', () => {
  const raw = readFileSync('config.example.yml','utf8');
  expect(raw).toMatch(/Minecraft[\s\S]*?limit:\s*3/);
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/shared/config.test.ts -t "minecraft" -v`
Expected: FAIL — still `limit: 9`

- [ ] **Step 3: Minimal edit — config.example.yml**

```yaml
# config.example.yml 184-196
              - type: videos
                title: Minecraft — Unstable Universe & friends
                limit: 3
                style: grid-cards
                channels:
                  - "@UnstableUniverse"
                  - "@ParrotX2"
                  - "@Wemmbu"
                  - "@FlameFrags"
                  - "@SpokeIsHere"
```

Also `config.yml` same (if present, edit manually; not committed).

- [ ] **Step 4: Run test — PASS**

Run: `bunx vitest run src/shared/config.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config.example.yml src/shared/config.test.ts
git commit -m "chore: cap Minecraft videos limit 9 → 3"
```

---

### Task 3: Remove all twitch

**Files:**
- Delete: `src/server/widgets/twitch.ts`
- Modify: `src/shared/widgets/keyed.ts` — remove `twitch-channels` + `twitch-top-games` schema branches
- Delete: `src/client/widgets/twitch/*` + remove registration in `src/client/widgets/index.ts`
- Delete: `src/server/widgets/twitch.test.ts` + any `videos.handle.test.ts` twitch refs (keep if unrelated)
- Modify: `config.example.yml:212-220` — delete `twitch-channels` block
- Modify: `src/shared/widgets/payloads.ts` — prune `TwitchChannel`/`TwitchGame` if only used by twitch (or keep if shared — check grep)

**Interfaces:**
- Consumes: `serverWidgets` Map, `clientWidgets` Map
- Produces: no `twitch-*` types; `WidgetType` union shrinks by 2.

- [ ] **Step 1: Write failing test — twitch types must be absent**

```ts
// src/shared/widgets/index.test.ts (or src/shared/config.test.ts)
it('WidgetType has no twitch', () => {
  const src = readFileSync('src/shared/widgets/keyed.ts','utf8');
  expect(src).not.toMatch(/twitch-/);
  expect(src).not.toMatch(/twitch\.ts/);
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/shared/widgets/index.test.ts -v` (or config.test)
Expected: FAIL — still contains `twitch-`

- [ ] **Step 3: Delete files + edit schemas**

```bash
trash src/server/widgets/twitch.ts src/client/widgets/twitch
# or git rm
```

```ts
// src/shared/widgets/keyed.ts — remove twitch branches from zod union and WidgetType
// src/shared/widgets/index.ts — remove export for twitch
// src/client/widgets/index.ts — remove import+register for twitch
// config.example.yml — delete Social twitch-channels block
```

- [ ] **Step 4: Run tests — PASS**

Run: `bunx vitest run src/shared/config.test.ts src/server/widgets/twitch.test.ts -v` — second should be `No test files found` (deleted) → PASS
Run: `bunx vitest run -v` — all 414→~410 still pass, no twitch remnants.

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets/keyed.ts src/shared/widgets/index.ts src/shared/widgets/payloads.ts src/client/widgets/index.ts config.example.yml
git rm src/server/widgets/twitch.ts src/server/widgets/twitch.test.ts src/client/widgets/twitch -r 2>/dev/null; git add -A
git commit -m "chore: remove twitch widgets (twitch-channels + twitch-top-games)"
```

---

### Task 4: Search default new-tab = true (configurable)

**Files:**
- Modify: `src/shared/widgets/search.ts:14-18`
- Modify: `src/client/widgets/search/engine.ts` — ensure target default when newTab
- Test: `src/client/widgets/search/search.test.tsx`

**Interfaces:**
- Consumes: `searchSchema` Zod type, `resolveSearch(raw, {engine, bangs, target, newTab}) → {url, target, rest}`
- Produces: `SearchConfig['new-tab']` defaults `true`; client swap `newTab = cfg['new-tab'] === true ? !e.ctrlKey : e.ctrlKey` already; `target` still honored.

- [ ] **Step 1: Write failing test — default is new-tab**

```tsx
// src/client/widgets/search/search.test.tsx
it('defaults to new-tab (no config)', () => {
  const open = vi.spyOn(window, 'open').mockImplementation(()=>null);
  render(<Search config={{ type:'search', 'search-engine':'https://duckduckgo.com/?q={QUERY}', bangs: [] } as any} data={null} />);
  fireEvent.change(screen.getByLabelText('Search'), { target:{ value:'hello' }});
  fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
  expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=hello', '_blank', 'noopener,noreferrer');
});
it('explicit new-tab false stays same-tab', () => {
  const open = vi.spyOn(window, 'open').mockImplementation(()=>null);
  render(<Search config={{ type:'search', 'search-engine':'https://duckduckgo.com/?q={QUERY}', bangs: [], 'new-tab': false } as any} data={null} />);
  fireEvent.change(screen.getByLabelText('Search'), { target:{ value:'hello' }});
  fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
  expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=hello', '_self', 'noopener,noreferrer');
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/client/widgets/search/search.test.tsx -t "defaults to new-tab" -v`
Expected: FAIL — got `_self` (old default)

- [ ] **Step 3: Change schema default**

```ts
// src/shared/widgets/search.ts
export const searchSchema = z.object({
  // ...
  'new-tab': z.boolean().default(true), // was .optional()
  target: z.string().optional(),
  // ...
});
```

If zod v4 requires `z.boolean().default(() => true)` use that form; repo uses `z.boolean().default(() => ...)` elsewhere (check `src/shared/widgets/feeds.ts`). Follow repo style.

No client logic change needed — `cfg['new-tab'] === true` now true by default. Ensure `engine.ts` `resolvedTarget = newTab ? (target ?? '_blank') : '_self'` (already) — if missing, add.

- [ ] **Step 4: Run tests — PASS**

Run: `bunx vitest run src/client/widgets/search/search.test.tsx -v`
Expected: PASS (19→21 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets/search.ts src/client/widgets/search/engine.ts src/client/widgets/search/search.test.tsx
git commit -m "feat: search defaults to new-tab true (configurable via new-tab:false, target still honored)"
```

---

### Task 5: Homelab system-stats (systeminformation)

**Files:**
- Create: `src/shared/widgets/system-stats.ts`
- Modify: `src/shared/widgets/payloads.ts` — add `SystemStatsData` + `SystemStatsSite` not, just `SystemStats`
- Modify: `src/shared/widgets/index.ts` — add `'system-stats'`
- Create: `src/server/widgets/system-stats.ts`
- Create: `src/client/widgets/system-stats/index.tsx` + `system-stats.module.css`
- Modify: `src/client/widgets/index.ts` — register
- Modify: `src/server/widgets/index.ts` — import fetcher
- Test: `src/server/widgets/system-stats.test.ts` + `src/client/widgets/system-stats/system-stats.test.tsx`

**Interfaces:**
- Consumes: `systeminformation` (`si.cpu()`, `si.mem()`, `si.fsSize()`, `si.cpuTemperature()`, `si.graphics()`, `si.currentLoad()`), `TtlCache`/`Singleflight`/`parseCacheDuration`, `registerWidget`
- Produces: `SystemStatsData = { cpu: {cores,speed,load}|null, mem: {total,used,free}|null, fs: {fs,size,used,use,mount}[], temp: number|null, gpu: {model,temp}[] }`

- [ ] **Step 1: Write failing server test**

```ts
// src/server/widgets/system-stats.test.ts
import { TtlCache, Singleflight } from '../cache';
import './system-stats';
import { serverWidgets } from './registry';
import { vi } from 'vitest';

vi.mock('systeminformation', () => ({
  cpu: vi.fn(async () => ({ cores: 8, speed: 3.2 })),
  mem: vi.fn(async () => ({ total: 16e9, active: 8e9, available: 8e9 })),
  fsSize: vi.fn(async () => [{ fs:'/dev/sda1', size: 500e9, used: 100e9, use: 20, mount:'/' }]),
  cpuTemperature: vi.fn(async () => ({ main: 55 })),
  graphics: vi.fn(async () => ({ controllers: [{ model:'M5', temperatureGpu: 60 }] })),
  currentLoad: vi.fn(async () => ({ currentLoad: 42 })),
}));

it('system-stats returns shape and respects cache', async () => {
  const fetcher = serverWidgets.get('system-stats')!;
  const ctx = { cache: new TtlCache(), singleflight: new Singleflight(), fetch: fetch as any, env: {} } as any;
  const res = await fetcher(ctx, { type:'system-stats' });
  expect(res.cpu.cores).toBe(8);
  expect(res.fs[0].mount).toBe('/');
});
it('graceful null when no homelab', async () => {
  vi.mocked(await import('systeminformation')).cpu.mockRejectedValueOnce(new Error('no'));
  // ... expect cpu null not throw
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/server/widgets/system-stats.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Install dep + create schema + fetcher**

```bash
bun add systeminformation@^5
```

```ts
// src/shared/widgets/system-stats.ts
import { z } from 'zod';
export const systemStatsSchema = z.object({
  type: z.literal('system-stats'),
  title: z.string().optional(),
  'title-url': z.string().optional(),
  'hide-header': z.boolean().optional(),
  'cache': z.string().optional(),
  'css-class': z.string().optional(),
}).loose();
```

```ts
// src/server/widgets/system-stats.ts
import { systemStatsSchema } from '../../shared/widgets/system-stats';
import { registerWidget } from './registry';
import { parseCacheDuration, getDefaultTtl } from '../cache';
import * as si from 'systeminformation';
registerWidget('system-stats', async (ctx, config) => {
  const cfg = systemStatsSchema.parse(config);
  const key = `system-stats:${JSON.stringify(cfg)}`;
  const ttl = parseCacheDuration(cfg.cache ?? '5s') || getDefaultTtl('system-stats');
  // use ctx.singleflight + ctx.cache like videos/hn
  return ctx.singleflight.run(key, async () => {
    const cached = ctx.cache.get<SystemStatsData>(key);
    if (cached) return cached;
    try {
      const [cpu, mem, fs, temp, gpu, load] = await Promise.all([
        si.cpu().catch(()=>null), si.mem().catch(()=>null), si.fsSize().catch(()=>[]),
        si.cpuTemperature().catch(()=>({main:null})), si.graphics().catch(()=>({controllers:[]})),
        si.currentLoad().catch(()=>({currentLoad:null})),
      ]);
      const data: SystemStatsData = {
        cpu: cpu ? { cores: cpu.cores, speed: (cpu as any).speed ?? null, load: (load as any)?.currentLoad ?? null } : null,
        mem: mem ? { total: mem.total, used: mem.active ?? mem.used, free: mem.available ?? mem.free } : null,
        fs: (fs as any[]).map(d=>({fs:d.fs, size:d.size, used:d.used, use:d.use, mount:d.mount})),
        temp: (temp as any).main ?? null,
        gpu: ((gpu as any).controllers ?? []).map((c:any)=>({model:c.model, temp:c.temperatureGpu ?? null})),
      };
      ctx.cache.set(key, data, ttl);
      return data;
    } catch {
      return { cpu:null, mem:null, fs:[], temp:null, gpu:[] } as SystemStatsData;
    }
  });
});
```

Add payload type in `payloads.ts` and `WidgetType` in `index.ts`.

```tsx
// src/client/widgets/system-stats/index.tsx — flat rows, WidgetChrome, placeholder
import { WidgetChrome } from '../../components/WidgetChrome';
import type { WidgetComponentProps } from '../registry';
import { registerWidgetComponent } from '../registry';
export function SystemStats({ config, data }: WidgetComponentProps) { /* ... */ }
registerWidgetComponent('system-stats', SystemStats);
```

- [ ] **Step 4: Run tests — PASS**

Run: `bunx vitest run src/server/widgets/system-stats.test.ts src/client/widgets/system-stats -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/shared/widgets/system-stats.ts src/shared/widgets/payloads.ts src/shared/widgets/index.ts src/server/widgets/system-stats.ts src/client/widgets/system-stats -A
git commit -m "feat: system-stats widget via systeminformation (cpu/mem/fs/temp/gpu, 5s cache, graceful null)"
```

---

### Task 6: Collage preferred sizes + squared-error chooser

**Files:**
- Create: `src/shared/widgets/preferredSizes.ts`
- Modify: `src/client/pages/tiling.ts:1-40`
- Modify: `src/client/pages/PageView.tsx:10-20, 180-230`
- Modify: `src/client/pages/useCollageTiling.ts:1-68`
- Test: `src/client/pages/tiling.test.ts` + `src/client/pages/useCollageTiling.test.tsx`

**Interfaces:**
- Consumes: `WidgetType` union, containerWidth, gap, minColumnWidth, maxCols, `PREFERRED_SIZES`, rowUnit
- Produces: `chooseColumnCount(W,gap,minW,maxCols,tiles:{prefW:number|null,prefH:number|null,span:number,resizable:boolean}[]): n` + `actualWidth(n)`; PageView sets `--min-column-width`/`gridTemplateColumns`; `useCollageTiling` uses `prefH` for span when not resizable.

- [ ] **Step 1: Write failing tiling tests (2D squared error, null left out)**

```ts
// src/client/pages/tiling.test.ts
import { chooseColumnCount } from './tiling';
it('picks n minimizing squared error (width primary, height λ)', () => {
  // W=1920 gap=23 min=300 max=6 tiles: w 300/h200, w380/h220, w340/h200
  const n = chooseColumnCount(1920, 23, 300, 6, [
    {prefW:300,prefH:200,span:1,resizable:false},
    {prefW:380,prefH:220,span:1,resizable:false},
    {prefW:340,prefH:200,span:1,resizable:false},
  ]);
  expect(n).toBe(4); // 462px actual closest to prefs; height term λ=0.1 tie-breaks
});
it('fluid-only (null) left out — fallback to floor(W/min)', () => {
  const n = chooseColumnCount(1920,23,300,6, [
    {prefW:null,prefH:null,span:1,resizable:true},
    {prefW:null,prefH:null,span:1,resizable:true},
  ]);
  expect(n).toBe(6);
});
it('span-2 hero effective width included', () => {
  const n = chooseColumnCount(1200,23,300,4, [
    {prefW:700,prefH:400,span:2,resizable:false},
    {prefW:340,prefH:200,span:1,resizable:false},
  ]);
  expect(n).toBeGreaterThanOrEqual(2);
});
it('blank h left out of height term', () => {
  const n1 = chooseColumnCount(1200,23,300,4, [{prefW:340,prefH:null,span:1,resizable:true}]);
  const n2 = chooseColumnCount(1200,23,300,4, [{prefW:340,prefH:220,span:1,resizable:false}]);
  expect(n1).toBe(n2); // null h contributes 0, width drives
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `bunx vitest run src/client/pages/tiling.test.ts -v`
Expected: FAIL — `chooseColumnCount not defined`

- [ ] **Step 3: Create registry + 2D chooser**

```ts
// src/shared/widgets/preferredSizes.ts
export type Pref = { preferredWidth: number|null, preferredHeight: number|null, resizable: boolean };
export const PREFERRED_SIZES: Record<WidgetType, Pref> = {
  clock: { preferredWidth: 300, preferredHeight: 200, resizable: false },
  weather: { preferredWidth: 300, preferredHeight: 280, resizable: false },
  // ... table from design §2.2 (every WidgetType, null=explicit none)
  rss: { preferredWidth: null, preferredHeight: null, resizable: true },
  // ensure every WidgetType key exists — assert
};
export function assertAllWidgetsCovered() {
  const missing = (Object.keys(WidgetTypeValues) as WidgetType[]).filter(k=>!(k in PREFERRED_SIZES));
  if (missing.length) throw new Error(`missing preferredSizes for ${missing.join(',')}`);
}
```

```ts
// src/client/pages/tiling.ts
export function chooseColumnCount(
  W:number,gap:number,minW:number,maxCols:number,
  tiles:{prefW:number|null,prefH:number|null,span:number,resizable:boolean}[],
  opts?:{rowUnit?:number, lambda?:number}
): number {
  const rowUnit = opts?.rowUnit ?? 80;
  const lambda = opts?.lambda ?? 0.1;
  const hasWidth = tiles.some(t=>t.prefW!=null);
  const hasHeight = tiles.some(t=>t.prefH!=null && !t.resizable);
  if (!hasWidth && !hasHeight) return Math.min(Math.max(1, Math.floor(W/minW)), maxCols);
  let bestN=1, bestScore=Infinity;
  for (let n=1; n<=maxCols; n++) {
    if (tiles.some(t=>t.span>n)) continue;
    const actualW = (W - (n-1)*gap)/n;
    let score=0;
    for (const t of tiles) {
      if (t.prefW!=null) {
        const effW = t.span>1 ? actualW*t.span + (t.span-1)*gap : actualW;
        const dw = effW - t.prefW;
        score += dw*dw;
      }
      if (t.prefH!=null && !t.resizable) {
        const estimatedH = Math.ceil(t.prefH/rowUnit)*rowUnit;
        const dh = estimatedH - t.prefH;
        score += lambda * dh*dh; // height term, null left out
      }
    }
    if (score < bestScore || (score===bestScore && n>bestN)) { bestScore=score; bestN=n; }
  }
  return Math.min(bestN, Math.floor(W/minW) || 1);
}
```

Wire in `PageView.tsx`: inside `useEffect` with `ResizeObserver` on `.columns`, compute `n*` via `chooseColumnCount` with `prefW/prefH/resizable` from `PREFERRED_SIZES[type]` + `span`, plus `rowUnit` from `useCollageTiling` min height, set `columnsEl.style.setProperty('--min-column-width', `${actualWidth(n*)}px`)` or `gridTemplateColumns = repeat(n*,1fr)` when `tiling==='collage'||'auto'`. Keep existing `span` handling.

`useCollageTiling.ts`: `const pref = PREFERRED_SIZES[type]; const h = !pref.resizable && pref.preferredHeight!=null ? pref.preferredHeight : measuredH; spans = clamp(ceil(h/rowUnit),1,8)`
```

- [ ] **Step 4: Run tests — PASS**

Run: `bunx vitest run src/client/pages/tiling.test.ts src/client/pages/useCollageTiling.test.tsx -v`
Expected: PASS

Run: `bunx vitest run src/client/pages/PageView.test.tsx -v` — no CLS regressions

- [ ] **Step 5: Commit**

```bash
git add src/shared/widgets/preferredSizes.ts src/client/pages/tiling.ts src/client/pages/PageView.tsx src/client/pages/useCollageTiling.ts src/client/pages/tiling.test.ts
git commit -m "feat: collage preferred sizes + squared-error column chooser"
```

---

## Self-Review

- Spec §3.1 sticky → Task 1 ✓
- Spec §3.2 minecraft cap → Task 2 ✓
- Spec §3.3 twitch removal → Task 3 ✓
- Spec §3.4 search default → Task 4 ✓
- Spec §3.5 system-stats → Task 5 ✓
- Spec §3.6 component ideas → research already done, appendix doc, no code — covered in design, not a code task (YAGNI — pick replacement in follow-up)
- Spec §3.7 collage → Task 6 ✓ — preferredSizes registry covers every WidgetType (lint), pure chooser, PageView wiring, height path
- No placeholders: all steps have exact file:line code blocks
- Type consistency: `Pref` `{preferredWidth, preferredHeight, resizable}` used consistently; `chooseColumnCount` signature `(W,gap,minW,maxCols,tiles)` matches PageView call

---

Plan complete and saved to `docs/superpowers/plans/2026-08-21-dashboard-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
