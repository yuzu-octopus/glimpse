# astryx-dracula Convention Migration — Design

Base: `9a0059c`. Status: **EXECUTED** (user: "migrate to that ui lib, follow all its conventions and design choices").

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
| C | `docs: single astryx-dracula theme` | README, AGENTS, the four Glimpse SKILLs, this spec — a commit cannot cite its own hash, so find it with `git log --grep` |

## Corrections to this spec, as executed
- The `--color-data-*` family is **55** tokens, not 56: 10 categorical + 9 sequential families × 5 levels. The shipped families are `blue`, `gray`, `orange`, `pink`, `purple`, `red`, `shamrock`, `teal`, `yellow` — not the `{gray,blue,green,orange,purple,red,pink,cyan,teal}` list sketched above. Chart widgets use the real names.
- `--color-data-*` tokens were NOT derived per preset; they ship with the kit, so the "every preset keeps its own `[light,dark]` pair" clause of the token contract is void.
- Importing the kit needed no port: `src/main.tsx` imports `astryx-dracula/tokens.css` then `theme.css` after the two Astryx core sheets and before `index.css`; the app keeps no colors of its own.

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

## Spacing canon (research: docs/research/spacing-density/REPORT.md)
`--space-gap` 23→**24** · `--space-viewport` 15→**16** · `--widget-content-horizontal` 17→**16** · `--widget-content-vertical` 15→**16** · `--widget-gap` 23→**24**. Aligned aliases move with them.

## Typography
`--font-size-base` 13→**14**, ratio 1.2, JetBrains Mono for body/heading/code.

## Waves
| Wave | Owner | Files |
|---|---|---|
| A1 | tokens | `src/shared/theme/glimpseTheme.ts`, `src/index.css` — later deleted by B1; the values now live in the kit |
| A2 | layer order + fonts | `vite.config.ts`, `index.html`, `src/main.tsx` |
| A3 | chart widgets | `src/client/widgets/{markets,dns,timer}/*` |
| A4 | brand pass | `src/client/components/*`, `src/client/pages/*` |
| B1 | import the kit | `src/main.tsx`, `src/index.css`, `index.html`, `src/client/theme/GlimpseThemeProvider.tsx`; deletes `glimpseTheme.ts`, `base16.ts`, `glanceRamp.ts` |
| B2 | brand collapse (vetoable) | `src/shared/config.ts`, `src/server/{index,config}.ts`, `GlimpseThemeProvider.tsx`, `SettingsPanel.tsx`; deletes `presets.ts`, `schemes.generated.ts`, `glanceHsl.ts` |
| C | docs | README, AGENTS, the four Glimpse SKILLs, this spec |

## Done criteria per wave
`bunx tsc --noEmit` · `bun run test` (no regressions) · `npx react-doctor@latest` · browser check at 3 widths.
