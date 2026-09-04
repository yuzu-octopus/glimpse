# 006 — Tiling + Skeleton Redesign (implements 005)

Base: `e2c784d`. Depends on 005. Status: TODO — blocked until 005 REPORT approved.

## Why

Execute the researched design: one placement module drives tiles, skeletons, and samples; desktop-first with tablet/mobile nice.

## Tasks (refine after 005)

1. Build single `place()` geometry module; PageView + skeletons consume it (delete the other two estimators).
2. Redesign component formats/defaults affected by new geometry (chrome spacing, density tokens, breakpoints).
3. Update ALL samples: `config.example.yml` pages + docs screenshots/snippets reflecting new defaults.
4. Responsive verification: desktop priority + tablet + mobile checked in browser (real Chromium, three widths).

Out: new widgets, palette changes.

## Done

Tiles == skeletons == samples at all widths; tsc/tests/doctor green; browser evidence at 3 widths. If research recommends against rewrite, this plan is void — say so instead.
