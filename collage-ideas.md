# Collage compositor — preferred sizes & squared deviation

## Current compositor
See JSON currentCompositor for full analysis. Three modes: columns (flex), auto (auto-fit grid), collage (dense grid + useCollageTiling JS row spans).

## Proposed preferred sizes
See JSON proposed.preferredSizes.

## Algorithm
n = argmin Σ(actualWidth(n) - prefW)² where actualWidth(n)=(W-(n-1)*gap)/n.
