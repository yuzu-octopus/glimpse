---
name: theming-glimpse
description: Use when customizing Glimpse appearance — choosing or overriding theme presets, writing the YAML theme block with glance HSL colors, forcing dark or light mode, using custom-css-file, adjusting fonts or CSS variables, or wondering why contrast-multiplier has no effect
---

# Theming Glimpse

## Overview
Three layers compose, last wins: **preset** (48 built-ins) → **YAML theme block** (glance HSL overrides) → **custom CSS file**. Mode (system/light/dark) is orthogonal and set in the nav picker or via the theme block.

## Presets
- Ids in `src/shared/theme/presets.ts`; default is `catppuccin-mocha` (dark).
- 42 base16-derived entries + 6 glance classics (`teal-city`, `camouflage`, `tucan`, `neon-pink`, `peachy`, `zebra`). Dark/light variants of one family share a single preset entry.

## YAML theme block
```yaml
theme:
  background-color: 256 22 10   # glance format: "H S L" integers, space-separated
  primary-color: 262 83 58      # space-separated ints (% optional, commas invalid) — not hsl(262,83%,58%)
  positive-color: 142 60 45     # success/ok states
  negative-color: 0 70 55       # errors/down states
  custom-css-file: ./custom.css # resolved relative to config.yml's directory
```
- Conversion: hex → `hsl(H S% L%)` → drop the `%` signs → `H S L` (percent signs are also accepted).
- These override the active preset's colors; they do NOT switch presets.
- **Forcing dark or light is NOT a config option.** Display mode comes from the nav settings panel, persisted per-browser in `localStorage['glimpse.theme.v1']` (default: follow system). `theme.light` only selects which side of the preset's light/dark pair receives the color overrides.
- `contrast-multiplier` / `text-saturation-multiplier`: parsed for glance-config compatibility but intentionally have no effect.

## Custom CSS
- File contents are injected as the LAST `<style>` tag on every page load — beats everything.
- Useful hooks are the CSS custom properties defined in `src/index.css`:
```css
/* custom.css */
:root {
  --font-size-base: 14px;   /* default 13px */
}
```
- Server reads the file fresh per request (5s mtime cache) — edits apply without restart.

## First-paint behavior
A snapshot of the applied scheme/colors is saved to `localStorage['glimpse.paint.v1']` and replayed by an inline script before React loads, so reloads don't flash. The very first visit (or an OS scheme change since last visit) can still show the default dark briefly until hydration.

## Common mistakes
- Writing hex values in the theme block — only `H S L` triplets accepted.
- Expecting `contrast-multiplier: 1.2` to change anything (see above).
- Putting `custom-css-file` path relative to repo root instead of config.yml's directory.
- Editing preset files in `src/shared/theme/` to rebrand — use the theme block + custom CSS; presets regenerate from `schemes.generated.ts`.
