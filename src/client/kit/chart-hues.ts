// Vendored from astryx-dracula@0.3.0 `shared/chart-hues.ts` (MIT) — re-sync this file on any kit version bump.
//
// One deliberate deviation: upstream also exports the `ChartHue` type and
// `CHART_HUE_VALUES`, which exist only to feed its own `scripts/check.ts` gate.
// This repo has no such gate and had that type deleted as dead, so importing it
// here would resurrect code with no consumer. Re-add from the kit if a local
// gate ever needs it.

// Shared categorical chart hues: the visual.md categorical ramp as importable
// constants. Every value is a role token var -- never a raw --dracula-* primitive
// and never a raw hex -- so the vocabulary is the sanctioned one by construction
// rather than by convention, and a gate can read the object and enforce it.
// Purple is deliberately absent: purple means tappable, so it must never encode
// data. `muted` is a COMMENT-blue grey because it backs the `{label: 'Other'}`
// legend row (dashboard.tsx:229, :253) -- a labelled data category, not chrome.

export const CHART_HUES = {
  cyan: 'var(--color-data-categorical-cyan)',
  orange: 'var(--color-data-categorical-orange)',
  green: 'var(--color-data-categorical-green)',
  pink: 'var(--color-data-categorical-pink)',
  muted: 'var(--color-data-categorical-blue)',
  // Added because --color-data-categorical-red exists in the palette
  // (tokens.css:276) and heat maps need a severity colour, but no module
  // exposed it. Without this, a chart could not reach red through the
  // sanctioned source at all.
  red: 'var(--color-data-categorical-red)',
} as const;
