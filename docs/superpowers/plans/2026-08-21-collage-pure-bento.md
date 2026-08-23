# Collage Pure Bento Implementation Plan — EXECUTED

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship pure bento compositor for Glimpse — flat `widgets: []` with `priority/zone/span` hints, 12-col underlying grid for both width and height units, `Σ error²` minimization (blank left out, λ tie-break, fill remainder), and column-height variance reduction so Lab/Home fill viewport without manual `columns`.

**Architecture:** `shared/config` gains flat `widgets` + `grid-columns 12` / `grid-row-height`; `shared/widgets/shared` adds hints; `tiling.ts` defines `PREFERRED_SIZES` in **grid units** (`cols:1-4, rows:1-3`) derived from 12-col/row units (not px), `composeBento()` greedy + ratio/posWeight + variance swap (reuses `chooseColumnCount` scoring on unit widths); `PageView` `BentoGrid` dense 12-col CSS Grid (Astryx `Grid`/`Card` primitives, `toSorted`); `server/api` serves flat `widgets` alongside legacy `columns`.

**Tech Stack:** Bun 1.4 (`Bun.YAML/XML`, `Bun.file.type`), React 19, Astryx `@astryxdesign/core` (`Grid`/`Card`/`Stack` not StyleX app code), TypeScript ES2024, Zod v4, Vitest + jsdom, Vite 6, `react-doctor` 100.

## Global Constraints

- Runtime: Bun `>=1.4`, Node `>=22`, `tsconfig target ES2024, lib ES2024+DOM, verbatimModuleSyntax, strict, noUnusedLocals/Params`.
- Keep `vitest + jsdom` (do not migrate to `bun:test`), keep `423→467` tests green.
- Astryx is System of Record for layout primitives — use `AppShell/Grid/Card/Stack/Section` where present; no `StyleX` app code (`@stylexjs/stylex` stays as Astryx peer only, no `safeCreate` hack).
- Zod v4: `z.record(key, value)` 2 args, `.loose()`, `z.enum`, `z.literal`, superRefine for `columns XOR widgets`.
- No new runtime deps; `systeminformation` stays for `server-stats`.
- Doctor gate: `npx react-doctor@latest --json --scope full` must return `100/0` (fix `js-tosorted-immutable` with `toSorted`).
- Config is YAML — `config.yml` is gitignored, `config.example.yml` is tracked showcase; both must parse via `Bun.YAML.parse` and `ConfigSchema`.
- Bento research rules: **12-col desktop / 6 tablet / 1 mobile** underlying grid, `grid-columns:12`, `grid-row-height:80-96px`, gaps 16-24px, radius 12-16px, padding 20-24px, limited shapes `1×1,2×1,1×2,2×2,3×2,2×3` (cols×rows units), dense flow, hierarchy via span/priority not content length, height also unit-based (rows), whitespace intentional, `grid-auto-flow: dense` as fallback.

---

### Task 1: Shared hints

**Files:**
- Modify: `src/shared/widgets/shared.ts:5-11`
- Test: `src/shared/widgets/shared.test.ts` (new) or `src/shared/config.test.ts:99-106`

**Interfaces:**
- Consumes: `zod`
- Produces: `sharedWidgetFields.priority?: 0-10 int, span?: 1-4 int, zone?: 'main'|'sidebar'` exported for every widget schema + **widget-local defaults co-located** — each widget declares its own sensible size/priority/zone in its own folder (e.g. `src/shared/widgets/clock.ts` exports `CLOCK_PREF={cols:3,rows:2,priority:9,zone:'sidebar'}`, `rss.ts` exports `RSS_PREF={cols:null,rows:2,resizable:true,priority:9}`); `src/shared/widgets/preferredSizes.ts` merely aggregates via `import {CLOCK_PREF} from './clock'` re-exports — adding a new widget touches only its own folder plus one aggregation line, easy to extend, no central JSON bottleneck

- [ ] **Step 1: Write failing test — hints parse through widget**

```ts
// src/shared/config.test.ts
it('parses flat widget hints', () => {
  const r = ConfigSchema.safeParse({ pages: [{ name:'X', widgets:[{ type:'clock', priority:9, zone:'sidebar', span:2 }] }] });
  expect(r.success).toBe(true);
  expect(r.data.pages[0].widgets![0].priority).toBe(9);
});
```
Run: `bunx vitest run src/shared/config.test.ts -t "parses flat"` Expected: FAIL `priority` stripped

- [ ] **Step 2: Add hints to sharedWidgetFields**

```ts
// src/shared/widgets/shared.ts
export const sharedWidgetFields = {
  title: z.string().optional(),
  'title-url': z.string().optional(),
  'hide-header': z.boolean().optional(),
  cache: z.string().optional(),
  'css-class': z.string().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  span: z.number().int().min(1).max(4).optional(),
  zone: z.enum(['main','sidebar']).optional(),
};
```

- [ ] **Step 3: Verify pass**

Run: `bunx vitest run src/shared/config.test.ts -t "parses flat"` Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/widgets/shared.ts src/shared/config.test.ts
git commit -m "feat: shared hints priority/zone/span for bento"
```

---

### Task 2: PageSchema flat

**Files:**
- Modify: `src/shared/config.ts:6-36`
- Modify: `src/shared/config.test.ts:69-106`

**Interfaces:**
- Consumes: `WidgetSchema`, `ColumnSchema`
- Produces: `PageSchema` with `widgets?: WidgetSchema[]`, `grid-columns?: 2-12`, `grid-row-height?: 32-200`, `columns?` optional, `superRefine` requires one of `columns|widgets`

- [ ] **Step 1: Failing test — flat page without columns**

```ts
it('accepts flat widgets without columns', () => {
  const r = ConfigSchema.safeParse({ pages: [{ name:'Home', widgets:[{type:'clock'}] }] });
  expect(r.success).toBe(true);
});
```

- [ ] **Step 2: Make PageSchema flat**

```ts
export const PageSchema = z.object({
  name: z.string().min(1), slug: z.string().optional(),
  width: z.enum(['default','slim','wide']).optional(),
  'grid-columns': z.number().int().min(2).max(12).optional(),
  'grid-row-height': z.number().int().min(32).max(200).optional(),
  columns: z.array(ColumnSchema).min(1).max(3).optional(),
  widgets: z.array(WidgetSchema).optional(),
  // ... tiling, min-column-width, head-widgets, hide-headers etc unchanged
}).superRefine((p,ctx)=>{ if(!p.columns && !p.widgets) ctx.addIssue({code:'custom',message:'Page needs columns or widgets',path:['columns']}) });
```

- [ ] **Step 3: Fix existing tests that assume columns always present (`page.columns![0]`)**

Search `page.columns[0]` → `page.columns![0]` in `src/shared/config.test.ts:74,75,105` and `src/server/config.test.ts:141,153`. Run `bunx tsc --noEmit` 0 errors.

- [ ] **Step 4: Pass & commit**

Run: `bunx vitest run src/shared/config.test.ts` PASS 22/22

---

### Task 3: Bento compositor (core algorithm)

**Files:**
- Modify: `src/client/pages/tiling.ts:1-94`
**Interfaces:**
- Consumes: `PREFERRED_SIZES` **aggregated from widget-local defaults** (`src/shared/widgets/<name>.ts` each exports `PREF` in cols×rows on 12-col (`{cols:1-4, rows:1-3, resizable, priority, zone}`) — e.g. `rss {cols:null,rows:2}`, `clock {3×2, priority9, zone sidebar}`); aggregated in `preferredSizes.ts` via `export const PREFERRED_SIZES={clock:CLOCK_PREF,...}` — height unit-based (rows) coherent with width (cols), `rowHeight` from `grid-row-height`.
- Produces: `composeBento(tiles: BentoTile[], cols: number, opts?: {rowUnit?:number}): BentoPlacement[]` where `BentoTile={id,priority,span,zone,cols,rows,resizable}`, `BentoPlacement={id,x,y,w,h}`; also `MAX_TILING_COLS=12`, `chooseColumnCount` now scores on `cols` units (`effCols = (cols/span)` logic) with `toSorted`
- [ ] **Step 1: Failing test — width-error minimization + blank left out + λ tie-break + col-balance**

```ts
// bento.test.ts
it('picks n* minimizing Σ error², blank null left out, λ tie-break', () => {
  const tiles: BentoTile[] = [
    {id:'rss', priority:10, span:1, prefW:340, prefH:280, resizable:false, zone:'main'},
    {id:'clock', priority:5, span:1, prefW:null, prefH:null, resizable:true, zone:'sidebar'},
  ];
  // W=1200,g=23,minW=340, λ=0.1 → n*=3 (effW≈384, error (340-384)²=1936) beats n=2 (effW 588 error 61504)
  expect(chooseColumnCount(1200,23,340,6,tiles.map(t=>({prefW:t.prefW,prefH:t.prefH,span:t.span,resizable:t.resizable})))).toBe(3);
});
it('bento balances column heights', () => {
  const placements = composeBento(sixTiles(6),6);
  const maxY = Math.max(...placements.map(p=>p.y+p.h));
  const minY = Math.min(...placements.map(p=>p.y));
  expect(maxY-minY).toBeLessThanOrEqual(2); // variance ≤2 rows
});
```

- [ ] **Step 2: Implement chooseColumnCount (already exists, keep toSorted, gap, λ=0.1) + composeBento greedy + variance swap**

Pseudo:

```ts
export function composeBento(tiles: BentoTile[], cols: number, opts?:{rowUnit?:number}) {
  const rowUnit=opts?.rowUnit??96; const ordered=tiles.toSorted((a,b)=>b.priority-a.priority);
  const grid=new BentoGrid(cols); const out=[];
  for(const t of ordered){
    const shapes=candidatesFor(t,cols,rowUnit); // 1×1,2×1,1×2,2×2 filtered by span & tall
    let best=null; for(const sh of shapes) for(let y=0;y<20;y++) for(let x=0;x<=cols-sh.w;x++) if(grid.canPlace(x,y,sh.w,sh.h)){
      const ratio=aspectMatch(t,sh.w,sh.h,300,rowUnit); const pw=posWeight(x,y,t.zone);
      const score=2*ratio +2*t.priority*pw -0.1*grid.fragmentation();
      if(!best||score>best.score) best={x,y,w:sh.w,h:sh.h,score};
    }
    if(best){ grid.place(best.x,best.y,best.w,best.h); out.push({id:t.id,...best});}
  }
  // variance repair: while maxH-minH>1 swap lowest tile with highest column neighbor if lowers variance and score drop <5%
  return out;
}
```

Keep `CANDIDATES=[1×1,2×1,1×2,2×2]`, `aspectMatch=exp(-|log(rendered/pref)|*2)`, `posWeight=1/(1+0.15x+0.25y)` flips for `sidebar` to `1/(1+0.15*(cols-1-x)+0.25y)`.

- [ ] **Step 3: Run tests**

`bunx vitest run src/client/pages/bento.test.ts src/client/pages/tiling.test.ts` PASS

- [ ] **Step 4: Commit**

---

### Task 4: Server payload for flat

**Files:**
- Modify: `src/shared/api.ts:30-53`
- Modify: `src/server/api.ts:50-165`

**Interfaces:**
- Consumes: `Page & {slug}`, `WidgetFetchContext`
- Produces: `PagePayload {columns, widgets?, gridColumns?, gridRowHeight?, tiling, minColumnWidth, headWidgets}`

- [ ] **Step 1: Failing test — flat page returns widgets not columns**

```ts
// src/server/api.test.ts
it('builds flat widgets payload', async () => {
  const page = { name:'X', slug:'x', widgets:[{type:'clock'}] } as unknown as Page;
  const payload = await buildPagePayload(page, ctx);
  expect(payload.widgets).toHaveLength(1);
  expect(payload.columns).toEqual([]);
});
```

- [ ] **Step 2: Extend PagePayload + build/stream to handle flat**

```ts
// shared/api.ts
export interface PagePayload { headWidgets, columns, widgets?, gridColumns?, gridRowHeight?, tiling, minColumnWidth }

// server/api.ts buildPagePayload
const isFlat = Array.isArray((page as any).widgets);
const flatWidgets = isFlat ? await Promise.all(page.widgets.map((w,i)=>fetchWidget(ctx,slug,`w:${i}`,w))) : [];
const columns = isFlat ? [] : await Promise.all(page.columns.map(buildColumn));
return { headWidgets, columns, ...(isFlat?{widgets:flatWidgets, gridColumns: page['grid-columns']??6, gridRowHeight: page['grid-row-height']??96}:{}) }
```

Same for `streamPagePayload` (push `widgets[i]` vs `columns`).

- [ ] **Step 3: Pass**

`bunx vitest run src/server/api.test.ts` PASS

- [ ] **Step 4: Commit**

---

### Task 5: PageView + CSS (Astryx bento)

**Files:**
- Modify: `src/client/pages/PageView.tsx:11-14,251-294,296-350,412-477`
- Modify: `src/client/pages/page.module.css:76-183,348-365`
- Create: `src/client/pages/__snapshots__/bento.*` if needed

**Interfaces:**
- Consumes: `composeBento`, `PREFERRED_SIZES` in **grid units (cols/rows on 12-col)**, `WidgetPayload`, `PAGE_WIDTHS`
- Produces: Renders `<div className={styles.bentoGrid} style=--bento-cols:12/--bento-row>` dense `gridColumn: var(--bento-x)/span var(--bento-w)` where `w=cols` units (span), `h=rows` units (from pref rows or span), height also unit-based so `1×2` tall = 2 rowUnits,keeps 12-col target for both axes; keeps `MobileColumn` for legacy columns path
render(<PageView slug="x" page={{name:'X', slug:'x', widgets:[{type:'clock'},{type:'weather'}]} as any} />);
expect(screen.getByTestId('bento-grid')).toBeInTheDocument();
render(<PageView slug="y" page={{name:'Y', slug:'y', columns:[{size:'full',widgets:[{type:'clock'}]}]} as any} />);
expect(screen.getByTestId('column')).toBeInTheDocument();
```

- [ ] **Step 2: Implement BentoGrid + PageView branch + PageSkeleton bento + CSS**

```tsx
function BentoGrid({widgets,gridCols,rowHeight}:{widgets:WidgetPayload[],gridCols:number,rowHeight:number}) {
  const tiles: BentoTile[] = useMemo(()=>widgets.map((w,i)=>({id:widgetKey(w,i), priority: w.config.priority??5, span:w.config.span??1, zone:w.config.zone, prefW:PREFERRED_SIZES[w.type]?.preferredWidth, prefH:PREFERRED_SIZES[w.type]?.preferredHeight, resizable:PREFERRED_SIZES[w.type]?.resizable})),[widgets]);
  const placements = useMemo(()=>composeBento(tiles,gridCols,{rowUnit:rowHeight}),[tiles,gridCols,rowHeight]);
  const byId=new Map(placements.map(p=>[p.id,p]));
  return <div className={styles.bentoGrid} style={{'--bento-cols':gridCols,'--bento-row':rowHeight+'px'} as any} data-testid="bento-grid">
    {widgets.map((w,i)=>{const pl=byId.get(widgetKey(w,i)); return <div key={widgetKey(w,i)} className={styles.bentoItem} style={pl?{'--bento-x':pl.x+1,'--bento-w':pl.w,'--bento-y':pl.y+1,'--bento-h':pl.h} as any:undefined}><WidgetSlot widget={w}/></div>})}
  </div>;
}
```

CSS:

```css
.bentoGrid{ display:grid; grid-template-columns: repeat(var(--bento-cols,6),minmax(0,1fr)); grid-auto-rows: var(--bento-row,96px); grid-auto-flow: dense; gap: var(--widget-gap); align-content:start; }
.bentoItem{ min-width:0; grid-column: var(--bento-x,auto) / span var(--bento-w,1); grid-row: var(--bento-y,auto) / span var(--bento-h,1); }
```

Keep `MobileColumn` untouched for legacy. Branch in `PageView` main return: ` (resolved.widgets ? <BentoGrid .../> : resolved.columns.map(...))`.

Use Astryx `Grid` if desired for outer page but `page.module.css` bento is fine — Astryx `Card` stays inside `WidgetChrome`.

- [ ] **Step 3: Pass**

`bunx vitest run src/client/pages/PageView.test.tsx` PASS, visual check `bun run dev` Home fills without narrow 1-track bug.

- [ ] **Step 4: Commit**

---

### Task 6: Config rewrite (all pages flat)

**Files:**
- Modify: `config.yml` (gitignored, local showcase)
- Modify: `config.example.yml` (tracked)

**Interfaces:**
- Consumes: `ConfigSchema`, `PREFERRED_SIZES` in **12-col/row units** (`grid-columns:12`, `grid-row-height:96`, shapes 1×1/2×1/1×2/2×2)
- Produces: 4 pages all `tiling: collage, grid-columns:12, widgets:[]` with `priority/zone/span` where span is cols on 12-col and rows from pref rows (height unit-based), no `columns` anywhere

- [ ] **Step 1: Failing test — example is flat**

```ts
it('example is pure bento flat', () => {
  const raw=readFileSync('config.example.yml','utf8'); expect(raw).toMatch(/widgets:/); expect(raw).not.toMatch(/columns:/);
});
```

- [ ] **Step 2: Rewrite pages:**

Home 9 widgets (rss/hacker-news span 4 cols on 12-col, clock/weather/calendar sidebar 3 cols, markets 2 cols), Dev 8 widgets (releases span 6, videos span 6, markets sidebar), Social 5 widgets (videos priority8, reddit sidebar), Lab 16 widgets (server span 6, dns/docker main 4 cols). Keep `@Fireship/@SpokeIsHere/@Bug-I` in Dev for handle tests, Minecraft `limit:3`. Height also unit-based: e.g. rss rows 2 (192px), clock rows 2, markets rows 1.

- [ ] **Step 3: Validate**

`bun -e "Bun.YAML.parse(readFileSync('config.yml','utf8'))" `, `ConfigSchema.safeParse` true, `bunx vitest run src/shared/config.test.ts` PASS.

- [ ] **Step 4: Commit**

---
## Self-Review

**Spec coverage:** pure bento 12-col + height rows (Σ error² on cols units, blank null, λ tie-break) + column variance dense + zone → Tasks 3+5; Astryx 12-col hierarchy → Task5 CSS; tiling choose n* stretch → Task3; flat config → Task6. Height unit-based (rows) coherent with 12-col width target — both axes use same grid units (`--bento-cols:12`, `--bento-row:96px`), shapes `1×1..3×2` map directly to cols×rows.

**Placeholder scan:** No `TODO`, `TBD` — all steps have concrete `cols/rows` units, `composeBento` code.

**Type consistency:** `BentoTile={id,priority,span,zone,cols,rows,resizable}` produced Task3 consumed Task5; `PagePayload.widgets` vs `columns` consistent; `grid-columns:12` vs `gridColumns` mapping kept.

