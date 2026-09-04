# 005 — Tiling Research (bento/collage/skeleton)

Base: `e2c784d`. No deps. Status: TODO.

## Why

Tiling is 3 overlapping systems (tiling.ts BentoGrid + useCollageTiling measure pass + PageView skeleton estimator) that disagree; skeletons don't match final layout. Redesign needs evidence first.

## Method (deep-research)

Brief at `docs/research/tiling/brief.md`. Angles: bento-grid packing algorithms · CSS `grid-auto-flow: dense` vs measure-pass · container-query interiors · skeleton-from-same-geometry patterns · responsive (desktop-first, tablet + mobile nice) · glance flex reference vs own identity.
Workers: 3–5 parallel, primary sources (specs, framework docs, source). Output: `docs/research/tiling/REPORT.md` with recommendation + geometry interface sketch.

## Done

REPORT.md with: recommended approach, single-placement-module interface (`place(widgets, width) → geometry` feeding tiles + skeletons + samples), responsive breakpoints (desktop priority), rejected alternatives with reasons. No code changes in this plan.
