// Vendored from astryx-dracula@0.2.1 `shared/chart-hues.ts` (MIT) — re-sync this file on any kit version bump.

// Shared categorical chart hues: the visual.md categorical ramp as importable
// constants. Every value is a Dracula token var — never a raw hex — and purple
// is deliberately absent: purple means tappable, so it must never encode data.

export const CHART_HUES = {
  cyan: 'var(--dracula-cyan)',
  orange: 'var(--dracula-orange)',
  green: 'var(--dracula-green)',
  pink: 'var(--dracula-pink)',
  muted: 'var(--dracula-comment)',
} as const;
