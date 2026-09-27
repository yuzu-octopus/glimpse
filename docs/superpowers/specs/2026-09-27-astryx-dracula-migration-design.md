# astryx-dracula Convention Migration — Design

Base: `9a0059c`. Status: **EXECUTED** (user: "migrate to that ui lib, follow all its conventions and design choices"). Waves A–E are landed; the sections below are the design as written at each point, and the *Corrections* section is the authoritative read where the two disagree.

## Landed commits
| Wave | Commit | What landed |
|---|---|---|
| A2 | `8d8ec75` | astryx CSS layer order (`@layer reset, astryx-base, astryx-theme`) |
| A1 | `6d137b8` | spacing + typography canon (24/16/16, 14px base) |
| A3 | `b74a7ee` | chart widgets on the `--color-data-*` palette |
| — | `f63f393` | events-calendar fixture now derived from a given clock (unrelated fix surfaced by A3) |
| A4 | `1696cfd` | brand principles in chrome + layout |
| A4 | `b2e4657` | follow-up: six widget stylesheets track `--font-size-base` |
| dep | `7d5786c` | `astryx-dracula` 0.2.1 added as the theme source |
| B1 | `7d73aec`, `aa5497a`, `f353478` | import the kit, delete `glimpseTheme.ts` / `base16.ts` / `glanceRamp.ts` / the whole preset pipeline, strip dead `:root` vars, add the token-contract test |
| B2 | `807d4c5` | collapse to the single theme: `theme:` config key rejected, `custom-css-file` hoisted to top level, picker/Settings appearance section and `glimpse.theme.v1` / `glimpse.paint.v1` removed |
| C | `47a9667` | docs: single astryx-dracula theme (README, AGENTS, the four Glimpse SKILLs, this spec) |
| D1 | `a2eb2d4`, `bbe1daf`, `02c2b76` | configurable `retries` (0–10, default 3) and `show-errors` (default true) as shared widget props, wired through every fetcher and every `WidgetChrome` |
| D2 | `2f2d96a`, `564ddc1` | `astryx.config.mjs` (CLI integration pack) + gitignore hygiene; the kit's brand layer vendored into `src/client/kit/` (`icons.ts` registering `draculaIconRegistry` first from `main.tsx`, `chart-hues.ts`, `sparkline.tsx`, `chart-labels.tsx`, `metric-delta.tsx`) |
| D3 | `51507c8`, `9d3fc07`, `94c6d07`, `122f84e` | glance type aliases `to-do`/`stocks`; `split-column` takes N children with `max-columns`; `custom-api` `subrequests` with `url` now optional; `check-config` accepts the alias spellings |
| E | `3d0c168` … `cf7c09b` (see below) | the minimisation wave — kit components replace hand-rolled chrome, colour follows identity, and the doc refresh that follows it |

### Wave E — minimisation, commit by commit
`3d0c168` tag hue by hash not position · `665d07b` contribution graph on the shamrock ramp · `dece61a` one hue for the ping series + the real mono token · `48b164b` ai-quota yellow chip / cyan bar · `d61a374` LIVE gets the kit StatusDot · `211f6d9`, `5f05a4d`, `fd7784d` 44px / 24px touch targets · `28e51a3` restore the 2px accent ring · `5ddcdaf` language chip is a tag · `46c4c46` drop direct fills on docker state dots · `384fc14` system-stats severity bars · `f36d114` drop the dead nth-child chip cycle · `aec1d42` lift 11px text to the 12px floor · `8df83f5` de-pill the utilisation bars · `02874cd` hash the bookmark accent · `ff860bc` restore the painted scrollbar · `562b938` delete two unreferenced stylesheets · `fdd552d`, `84d48fd`, `837e44b`, `4cf9ebb`, `1653666`, `99a952e`, `3cd6b01`, `8be149f`, `cf7c09b` — feed, custom-api, releases, chrome, settings, top-nav, twitch onto kit components, each deleting the CSS it replaced. Unrelated fixes surfaced by the wave: `3effb2d`, `56c2801`, `97abe4a`, `188ec71`, `dc3890a`, `02c2b6e`, `a2eca2f`, `648262b`.

## Corrections to this spec, as executed
- The `--color-data-*` family is **55** tokens, not 56: 10 categorical + 9 sequential families × 5 levels. The shipped families are `blue`, `gray`, `orange`, `pink`, `purple`, `red`, `shamrock`, `teal`, `yellow` — not the `{gray,blue,green,orange,purple,red,pink,cyan,teal}` list sketched below. Chart widgets use the real names.
- `--color-data-*` tokens were NOT derived per preset; they ship with the kit, so the "every preset keeps its own `[light,dark]` pair" clause of the token contract is void.
- Importing the kit needed no port: `src/main.tsx` imports `./client/kit/icons` first, then `astryx-dracula/tokens.css` then `theme.css` after the two Astryx core sheets and before `index.css`; the app keeps no colors of its own.
- **Wave D shrank the config surface further, not the code.** `retries` / `show-errors` became shared widget props; `to-do` / `stocks` folded onto `todo` / `markets`; `split-column` accepts N children plus `max-columns`; `custom-api` gained `subrequests` and made `url` optional (at least one of the two is required). None of it touched the theme.
- **Wave E changed what "chart widget" means.** Categorical series now come from the vendored `CHART_HUES` (5 purple-free `--dracula-*` slots) via the kit's own `Sparkline` / `ChartLabel` / `MetricDelta`; the `--color-data-*` family is now the *sequential* vocabulary (the contribution heatmap's shamrock ramp) plus a few accent bars, not the per-chart categorical palette A3 assumed.
- **Wave E also made colour positional-assignment a defect.** Chip hue is hashed from the identity via `tagAccent()` (tag text / bookmark URL); `:nth-child` cycling is gone. `--color-tag-blue` is excluded from the cycle because in this kit it is literally the tappable purple.

## Decision
Adopt `astryx-dracula` (`../astryx-dracula`, MIT) as the UI library. Follow its token vocabulary, spacing, typography, surfaces, and brand principles.

## What is NOT a port
`defineTheme` is already ours. **72 of our ~72 theme tokens already share the kit's exact names** (`--space-gap`, `--radius-*`, `--color-text-*`, `--color-icon-*`, `--color-tag-*`, `--font-size-*`). There is no API port. What we lack is the kit's *deeper vocabulary* (56 `--color-data-*` tokens) and its *design decisions*.

## Known cost (stated once, user reaffirmed)
The kit is one dark-only brand (`pin()` forces both tuple slots equal). Full adoption drops our 48 base16 presets, light mode, theme picker, and config HSL overrides. Sequence so the reversible part lands first and brand collapse is a separate vetoable commit.

## Brand principles adopted (verbatim from kit SKILL.md)
1. Dark is the brand, not a mode.
2. Purple = tappable (links, titles, primary actions). Nothing decorative is purple.
3. Fixed status vocabulary: green positive · red negative · yellow tags/warning · cyan info · orange attention. Status surfaces = 10% categorical washes + semantic borders, never direct fills.
4. Mono everywhere: JetBrains Mono for body, heading, code.
5. Dense, not cramped.
6. Two-tier hierarchy: widget headers pair `Heading level={3}` with `Text type="supporting"`.
7. Flat and crisp: 5px element radii, 4px inner. No pills. **No soft grey shadows — depth comes from borders.**
8. Motion answers action: hover dims, press dims more, focus rings accent. No entrance choreography, no card hover lifts.

## Token additions (contract — A1 defines, A3 consumes)
- `--color-data-categorical-{blue,orange,purple,green,pink,cyan,red,teal,brown,indigo}`
- `--color-data-{gray,blue,green,orange,purple,red,pink,cyan,teal}-{1..5}` (sequential ramps)
- Derived per-preset from each preset's existing hues — every preset keeps its own `[light,dark]` pair.

## Spacing canon (research: `../astryx-dracula/docs/research/spacing-density/REPORT.md`)
`--space-gap` 23→**24** · `--space-viewport` 15→**16** · `--widget-content-horizontal` 17→**16** · `--widget-content-vertical` 15→**16** · `--widget-gap` 23→**24**. Aligned aliases move with them.

## Typography
`--font-size-base` 13→**14**, ratio 1.2, JetBrains Mono for body/heading/code.

## Waves
| Wave | Owner | Files |
|---|---|---|
| A1 | tokens | `src/shared/theme/glimpseTheme.ts`, `src/index.css` — later deleted by B1; the values now live in the kit |
| A2 | layer order + fonts | `vite.config.ts`, `index.html`, `src/main.tsx` |
| A3 | chart widgets | `src/client/widgets/{markets,dns,timer}/*` — later joined by network, contribution-graph, ai-quota, server-stats, system-stats, twitch; the shared primitives moved to `src/client/kit/` in D2 |
| A4 | brand pass | `src/client/components/*`, `src/client/pages/*` |
| B1 | import the kit | `src/main.tsx`, `src/index.css`, `index.html`, `src/client/theme/GlimpseThemeProvider.tsx`; deletes `glimpseTheme.ts`, `base16.ts`, `glanceRamp.ts` |
| B2 | brand collapse (vetoable) | `src/shared/config.ts`, `src/server/{index,config}.ts`, `GlimpseThemeProvider.tsx`, `SettingsPanel.tsx`; deletes `presets.ts`, `schemes.generated.ts`, `glanceHsl.ts` |
| C | docs | README, AGENTS, the four Glimpse SKILLs, this spec |
| D1 | resilience config | `src/shared/widgets/shared.ts`, `src/server/widgets/http.ts` + every fetcher, every `src/client/widgets/*/index.tsx` (`showErrors`), `WidgetChrome.tsx` |
| D2 | brand layer | `src/client/kit/*` (new), `src/main.tsx`, `vite.config.ts`, `astryx.config.mjs` |
| D3 | config surface | `src/shared/widgets/{shared,aliases,group,keyed}.ts`, `src/shared/widgets/index.ts`, `src/server/widgets/custom-api.ts`, `src/client/pages/PageView.tsx`, `scripts/check-config.ts` |
| E | minimisation | `src/client/kit/*` consumers, `src/client/widgets/*` + `*.module.css`, `src/client/components/*`, `src/client/widgets/feed/tag-accent.ts` |
| E | docs (this pass) | README, AGENTS, the four Glimpse SKILLs, `config.example.yml`, this spec |

## Done criteria per wave
`bunx tsc --noEmit` · `bun run test` (no regressions) · `npx react-doctor@latest` · browser check at 3 widths.

## Where the rules live now
This spec is history. The current, load-bearing rules are:
- **What the app looks like** — `.agents/skills/theming-glimpse/SKILL.md` (tokens, `src/client/kit/`, the tag-accent hashing rule, the two chart vocabularies).
- **How a widget is written** — `.agents/skills/adding-widgets/SKILL.md` (generator-first flow, the post-minimisation house style, `CHART_HUES` over hand-rolled hues).
- **What a config may contain** — `.agents/skills/configuring-glimpse/SKILL.md` and `config.example.yml`.
- **Why it is built this way** — `AGENTS.md` (data flow, key directories, widget checklist, gates).

## Known follow-ups
- Two stylesheets still sit below the brand's 12px text floor: `src/client/widgets/docker/docker.module.css` (11px) and `src/client/widgets/contribution-graph/contribution-graph.module.css` (10px).
- `scripts/new-widget.ts` scaffolds a `WidgetChrome` that omits `showErrors`, uses a bare `<div>` row, and declares its payload type locally instead of in `payloads.ts` — the generator output is a stub, not house style.
