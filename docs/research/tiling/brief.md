# 005 Tiling Research — Brief

## Problem

Page tiling is 3 overlapping systems that disagree:

1. tiling.ts — BentoGrid priority search plus column-count chooser.
2. useCollageTiling — JS measure pass (scrollHeight reads, grid-row writes, rAF plus ResizeObserver).
3. PageView skeleton estimator — config-only 1-3 row guess, clamped 1-8.

Skeletons do not match final layout, so first paint shifts on fill.
Evidence first, redesign second (plan 006 implements the recommendation).
## Questions

- Q1: Can pure CSS (grid-auto-flow dense plus explicit spans) replace the measure pass?
- Q2: What single pure function can feed tiles, skeletons, AND samples identically?
- Q3: How should widget interiors adapt to tile width (container queries vs props)?
- Q4: What breakpoints serve desktop-first with tablet and mobile acceptable?
- Q5: What do we keep from the glance flex reference, and where is our identity?

## Angles

1. Bento packing algorithms.
2. dense vs measure-pass.
3. Container-query interiors.
4. Skeleton-from-same-geometry.
5. Desktop-first responsive plus glance reference.

## Method

Web search plus primary sources (Grid spec, MDN, web.dev CLS guides, glance docs).
No source edits. Output: REPORT.md with recommendation plus place() sketch plus rejections.
