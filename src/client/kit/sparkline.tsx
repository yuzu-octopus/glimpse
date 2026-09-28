// Vendored from astryx-dracula@0.3.1 `shared/sparkline.tsx` (MIT) — re-sync this file on any kit version bump.
//
// One deliberate deviation: upstream imports `{CHART_HUES}` from
// 'astryx-dracula/shared/chart-hues'. Vendored verbatim that would pull the
// package's own CHART_HUES in beside this repo's copy — two objects that can
// drift, which is the exact failure 0.3.1 fixed. The import is repointed at the
// sibling ./chart-hues so the vendored kit stays self-contained.

// Merged trend-bar sparkline: absorbs the dashboard max-normalized fixed
// geometry and the portfolio range-normalized step geometry behind one mode
// switch. Purple stays out of the chart so it keeps meaning "interactive".

import {CHART_HUES} from './chart-hues';

export interface SparkPoint {
  id: string;
  value: number;
}

interface SparklineProps {
  data: SparkPoint[];
  /** REQUIRED and unique per instance: 4+ sparklines sharing one name is an
   *  a11y defect (the portfolio bug this module fixes). */
  label: string;
  positive: boolean;
  /** max: fixed geometry normalized against the series max (dashboard tiles).
   *  range: step geometry normalized against the series range (market rows).
   *  @default 'max' */
  mode?: 'max' | 'range';
  /** @default false */
  isCompact?: boolean;
}

export function Sparkline({
  data,
  label,
  positive,
  mode = 'max',
  isCompact = false,
}: SparklineProps) {
  // Role tokens, not --dracula-* primitives. Byte-identical values
  // (--color-data-categorical-green IS #50FA7B), so this is a vocabulary
  // change with no visual delta -- it just means the sparkline agrees with
  // chart-hues.ts instead of being the one chart module that decided alone.
  // Reported by a consumer whose test asserted their sparkline fill equalled
  // their CHART_HUES.green and stopped agreeing across a version bump.
  const fill = positive ? CHART_HUES.green : CHART_HUES.red;
  if (mode === 'range') {
    const values = data.map(point => point.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = Math.max(1, max - min);
    const step = 300 / data.length;
    const height = isCompact ? 24 : 40;
    const baseline = isCompact ? 21 : 36;
    const plot = isCompact ? 18 : 32;
    const floor = isCompact ? 2 : 3;
    const barWidth = Math.max(1.5, step - 1);
    return (
      <svg
        viewBox={`0 0 300 ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={label}>
        {data.map((point, slot) => {
          const barHeight = Math.max(
            floor,
            ((point.value - min) / range) * plot,
          );
          return (
            <rect
              key={point.id}
              x={slot * step}
              y={baseline - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(2, barWidth / 2)}
              fill={fill}
            />
          );
        })}
      </svg>
    );
  }
  const max = Math.max(...data.map(point => point.value));
  return (
    <svg
      viewBox="0 0 300 40"
      width="100%"
      height={40}
      role="img"
      aria-label={label}>
      {data.map((point, day) => {
        const barHeight = Math.max(3, (point.value / max) * 32);
        return (
          <rect
            key={point.id}
            x={day * 10}
            y={36 - barHeight}
            width={7}
            height={barHeight}
            rx={3.5}
            fill={fill}
          />
        );
      })}
    </svg>
  );
}
