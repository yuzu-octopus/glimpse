// Vendored from astryx-dracula@0.2.1 `shared/chart-labels.tsx` (MIT) — re-sync this file on any kit version bump.

// Shared SVG chart-axis/label primitives. Every hand-drawn chart label goes
// through ChartLabel: token fill plus the 13px mono floor from visual.md
// (nothing meaningful below 12px, ever). The mono family resolves from the
// `--font-family-mono` theme token, single-sourced with the body/code faces.

import type {ReactNode} from 'react';

export const CHART_LABEL_FILL = 'var(--color-text-paragraph)';
export const CHART_LABEL_SIZE = 13;

interface ChartLabelProps {
  x: number | string;
  y: number | string;
  textAnchor?: 'start' | 'middle' | 'end';
  /** Defaults to the paragraph token; pass an explicit fill for values drawn
   *  on colored fills (e.g. in-cell heatmap counts). */
  fill?: string;
  children: ReactNode;
}

export function ChartLabel({
  x,
  y,
  textAnchor = 'middle',
  fill = CHART_LABEL_FILL,
  children,
}: ChartLabelProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={CHART_LABEL_SIZE}
      fill={fill}
      fontFamily="var(--font-family-mono)">
      {children}
    </text>
  );
}
