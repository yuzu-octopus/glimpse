---
name: theming-glimpse
description: Use when changing how Glimpse looks — colors, spacing, typography, radii, chart hues, fonts, dark mode, a stale `theme:` block in config.yml, custom CSS, or a config that fails validation on `config.theme`
---

# Theming Glimpse

## Overview
Glimpse ships **exactly one theme**: [`astryx-dracula`](https://github.com/yuzu-octopus/astryx-dracula) (MIT), the pure Dracula brand for Astryx. It is a **runtime dependency** (`^0.2.1`), not a fork — the CSS and the `<Theme>` object both come from the package.

There is nothing to switch. No presets, no light mode, no picker, no `theme:` block. The theme is the brand, and the brand is dark.

## The one knob: `custom-css-file`
```yaml
custom-css-file: ./custom.css   # TOP-LEVEL key, path relative to config.yml's directory
```
Injected as the last `<style>` tag, so it beats the kit. Server re-reads it per request (5s mtime cache) — edits apply without a restart. This is the only supported appearance override.

## If a config still has `theme:`
It is a **validation error**, one issue total, path `config.theme`:
```
config.theme: block removed — Glimpse now uses the astryx-dracula theme; delete the theme block from your config (if you set a custom stylesheet, move it to a top-level `custom-css-file:` key)
```
Auto-reload failure keeps the last good config active. Fix: delete the whole `theme:` block; hoist `custom-css-file` to the top level if it was set. Validate with `bun run check-config`.

## Valid config surface
`pages` (required) and `custom-css-file` (optional). Nothing else is a valid top-level key.

## Brand rules (from the kit, load-bearing)
1. Dark is the brand, not a mode — `mode="dark"` is hardcoded.
2. Purple = tappable (links, titles, primary actions). Nothing decorative is purple.
3. Fixed status vocabulary: green positive · red negative · yellow tags/warning · cyan info · orange attention. Status surfaces are 10% categorical washes + semantic borders, never direct fills.
4. JetBrains Mono for body, heading, and code.
5. Dense, not cramped.
6. Two-tier hierarchy: widget headers pair `Heading level={3}` with `Text type="supporting"`.
7. Flat and crisp: 5px element radii, 4px inner. No pills. **No soft grey shadows — depth comes from borders.**
8. Motion answers action: hover dims, press dims more, focus rings accent. No entrance choreography, no card hover lifts.

## Tokens
`astryx-dracula/tokens.css` (287 unlayered `:root` vars — the pre-`<Theme>` paint fallback) + `astryx-dracula/theme.css` (276 unique vars inside `@layer reset` / `@layer astryx-theme`, `@scope`d to `[data-astryx-theme]`) are the source of truth. Never write a hex; consume `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-size-*)`, or the 20 `--dracula-*` primitives in `tokens.css`.

**Charts have two vocabularies, on purpose.**
- *Categorical series* → `CHART_HUES` from `astryx-dracula/shared/chart-hues` (`cyan`, `orange`, `green`, `pink`, `muted`, `red`). Six slots, purple-free by construction, because purple means tappable and must never encode data. Hand-rolling a per-template hue list is a defect.
- *Sequential ramps* → the 54 `--color-data-*` tokens: 8 categorical slots (`--color-data-categorical-{blue,cyan,green,indigo,orange,pink,red,teal}`) plus `--color-data-neutral` and 9 sequential families (`blue`, `gray`, `orange`, `pink`, `purple`, `red`, `shamrock`, `teal`, `yellow`) at levels 1–5. Use a ramp when the value is an *amount* (a contribution heatmap), never for identity.

## Chart and icon modules: import, never copy

Every brand primitive is a subpath export of the kit. Import it; do not copy it into the repo.

| Module | What it owns |
|---|---|
| `astryx-dracula/shared/chart-hues` | `CHART_HUES` — the categorical series palette, on `--color-data-categorical-*` role tokens |
| `astryx-dracula/shared/sparkline` | `Sparkline` (`mode: 'max' \| 'range'`, unique `label` per instance) |
| `astryx-dracula/shared/data-bar` | `DataBar` — magnitude against a domain (quota/headroom/budget). NOT core's `ProgressBar`, which is for task completion |
| `astryx-dracula/shared/metric-delta` | `MetricDelta` — the one KPI-delta pattern |
| `src/client/kit/icons.ts` | **ours, and the only local file.** Wires core's `registerIcons` to `draculaIconRegistry`; import FIRST in `main.tsx`, because the icon registry is module state and a later call leaves the first painted tree on core's icons |

A copied file is the thing that drifts. This repo briefly vendored four of these, which cost a re-sync contract, a header
comment on every file, three hand-written deviations and a fidelity test to police them — all unnecessary, since the package
path resolves under tsc, Vite and vitest. **Bumping the dependency IS the re-sync.** A brand change is a change to the kit's
`astryx-dracula` package, never to a local copy.

## Colour follows identity, not position
Tag and bookmark chips take their accent from `tagAccent()` (`src/client/widgets/feed/tag-accent.ts`), an FNV-style hash of the tag text or bookmark URL over `['green', 'cyan', 'pink', 'orange']`. `--color-tag-blue` is deliberately excluded: in this kit it is literally the tappable purple, so cycling through it would paint purple under another name. Yellow is the default and lives on the base chip class. `:nth-child` colour cycling was removed — colour assigned by DOM position is decoration, and it made the same tag a different colour on every row. Any new coloured identity hashes the same way.

## Changing the look
1. **Never** override `--color-*` in the app's `:root` — app CSS is unlayered and imported last, so it silently outranks the kit, and stale overrides are the #1 "wrong colors" cause.
2. **Never** invent hexes. A brand change is a change to the kit's `astryx-theme.ts`, released as a version bump, then `bun install`; re-sync `src/client/kit/` on the same bump.
3. Per-instance tweaks: Astryx component props first, then `css-class` on a widget plus a rule in `custom-css-file`. A rule there needs more specificity than the app's own unlayered CSS, or it loses.

## Common mistakes
- Writing hex or `H S L` triplets in `config.yml` — there is no theme block; those keys are gone.
- Looking for a picker or appearance controls in Settings, or expecting `prefers-color-scheme` to do anything.
- Overriding `--color-*` in `src/index.css` to "fix" a color instead of fixing the kit version.
- Skipping `bun run check-config` after deleting `theme:` and assuming the reload picked it up.
- Picking a chart series colour by hand instead of `CHART_HUES`, or using a `--color-data-*` ramp for identity instead of for magnitude.
- Assigning a chip or row colour by `:nth-child` — hash the identity with `tagAccent()`.
- Copying a module out of `node_modules/astryx-dracula/shared/` into `src/client/kit/` instead of importing the subpath — a local copy is what drifts.ion-stamped.
- Expecting `color-scheme: dark` to be a brand decision you can flip — it is a constant, and the brand has no light tier.
