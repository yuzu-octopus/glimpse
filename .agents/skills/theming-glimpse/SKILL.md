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
`astryx-dracula/tokens.css` (62 `:root` vars) + `astryx-dracula/theme.css` (270 vars, lands in the `astryx-theme` CSS layer) are the source of truth. Chart widgets consume the 55 `--color-data-*` tokens: 10 categorical slots (`--color-data-categorical-{blue,orange,purple,green,pink,cyan,red,teal,brown,indigo}`) plus 9 sequential families (`blue`, `gray`, `orange`, `pink`, `purple`, `red`, `shamrock`, `teal`, `yellow`) at levels 1–5.

App-local `:root` values are limited to what the kit does not ship: `--tile-row`, `--mobile-navigation-height`, the `--widget-content-*-padding` aliases, and the flair aliases (`--color-magenta`, `--color-orange` → kit tags). No colors. Scrollbars and form-control chrome come from the kit's `tokens.css`.

## Changing the look
1. **Never** override `--color-*` in the app's `:root` — kit rules forbid it, and stale overrides are the #1 "wrong colors" cause.
2. **Never** invent hexes. A brand change is a change to the kit's `astryx-theme.ts`, released as a version bump, then `bun install`.
3. Per-instance tweaks: Astryx component props first, then `css-class` on a widget plus a rule in `custom-css-file`.

## Common mistakes
- Writing hex or `H S L` triplets in `config.yml` — there is no theme block; those keys are gone.
- Looking for a picker or appearance controls in Settings, or expecting `prefers-color-scheme` to do anything.
- Overriding `--color-*` in `src/index.css` to "fix" a color instead of fixing the kit version.
- Skipping `bun run check-config` after deleting `theme:` and assuming the reload picked it up.
