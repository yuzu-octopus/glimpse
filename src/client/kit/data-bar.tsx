// Vendored from astryx-dracula@0.3.1 `shared/data-bar.tsx` (MIT) — re-sync this file on any kit version bump.
//
// One deliberate deviation: upstream imports `type {ChartHue}` from
// 'astryx-dracula/shared/chart-hues'. This repo's ./chart-hues deleted that
// type as dead (it only fed upstream's own check.ts gate), so the import is
// repointed at the sibling ./chart-hues and the hue union is spelled inline
// from the CHART_HUES object — the same tokens, one vocabulary, no second
// copy of the module in the bundle. Vendoring the import verbatim would pull
// the package's CHART_HUES in beside this repo's, two objects that can drift,
// which is the exact failure 0.3.1 fixed for sparkline.tsx.

// Shared data bar: a magnitude against a domain (quota, budget, allocation,
// bandwidth headroom). This is NOT core's ProgressBar, and the difference is
// the whole point of this file.
//
// WHY THIS EXISTS: core's ProgressBar is a TASK-progress component. Its own
// JSDoc frames it as completion of known-duration work and says "Don't place
// icons or labels inside the bar" and "Don't use a progress bar for instant
// actions". Nine demo sites were using it for quota/headroom/budget meters — a
// quantity that is not a percentage of anything and never completes. Those nine
// now use this. If you are about to write "Risk level" value={15} with a
// success colour and a hidden number, you are repeating the bug this module
// exists to end: 15 is not 15% of anything, the number is invisible, and
// success-green tells the reader the opposite of what a risk bar means.
//
// COLOUR CONTRACT (UIAuditColorMotion, measured against the surface each
// element paints on):
//   - A mark resolves to --color-data-categorical-* or a --color-data-<family>-N
//     step. It does NOT resolve to a raw --dracula-* primitive. That discipline
//     is what makes the 56 --color-data-* tokens load-bearing instead of
//     decorative; before this module, zero of them had a single consumer.
//   - On-fill text is dark. No Dracula fill carries #F8F8F2 at 4.5:1 (best case
//     Functional Purple #815CD6 at 4.44:1), so dark on-fill is forced. The value
//     is already pinned at tokens.css:208-211 and clears AA on all 7 accents.
//     Do not let a contrast-solving heuristic reintroduce #000000 — raw black is
//     a colour the spec never uses.
//
// INHERITED-FROM-CORE WARNING, verified against @astryxdesign/core 0.3.0:
// core paints its neutral/disabled fill with a TEXT token —
// ProgressBar.tsx:303,306 -> dist/astryx.css:586 (class x16fr6go) is
// `background-color: var(--color-text-disabled)`. In this theme
// --color-text-disabled and --color-progress-value are BOTH pin(DRA.comment)
// #6272A4 (astryx-theme.ts:147 and :279), so the role substitution is invisible
// by coincidence — zero delta is exactly why it survived. The neutral fill below
// uses --color-progress-value, the token that means what it says.
//
// Not interactive. A data bar is not a control, so it carries no hover channel
// and no focus ring; the inset-ring decision belongs to interactive surfaces.

import type {CSSProperties} from 'react';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {CHART_HUES} from './chart-hues';

type ChartHue = (typeof CHART_HUES)[keyof typeof CHART_HUES];

export interface DataBarSegment {
  /** Stable key for the segment. */
  id: string;
  value: number;
  /** MUST be a --color-data-categorical-* or --color-data-<family>-N var.
   *  Never a raw hex, never a --dracula-* primitive. Typed rather than
   *  documented: `string` made the rule a comment nobody could break. */
  color: ChartHue | `var(--color-data-${string})`;
}

/** Minimum segment share, so a tiny non-zero value stays visible. */
const MIN_SEGMENT_PCT = 2;

export interface DataBarProps {
  /** Accessible name. Required — a bar with no name is an unlabelled graphic. */
  label: string;
  segments: readonly DataBarSegment[];
  /** Bar thickness in px. @default 12 */
  height?: number;
  /** Show the summed value under the bar. @default false */
  hasValueLabel?: boolean;
  /** Formats the summed value. @default toLocaleString() */
  formatValue?: (total: number) => string;
  /** Gap between segments as a spacing-scale step. @default 0 */
  gap?: 0 | 0.5 | 1 | 1.5 | 2 | 3;
  /** Neutral fill shown when every segment is zero. Deliberately
   *  --color-progress-value, NOT a text token — see the header. */
  trackColor?: string;
}

const segmentStyle: CSSProperties = {
  borderRadius: 'var(--radius-inner)',
};

export function DataBar({
  label,
  segments,
  height = 12,
  hasValueLabel = false,
  formatValue = total => total.toLocaleString(),
  gap = 0,
  trackColor = 'var(--color-progress-value)',
}: DataBarProps) {
  // Negative values are not a magnitude and are clamped out before the ratio is
  // taken: summing a negative into `total` inflates every other segment's
  // share and can push the bar past 100%. An empty or all-zero bar falls
  // through to the track fill below.
  const total = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0,
  );
  const visible = segments
    .map(segment => {
      if (segment.value <= 0) return null;
      return {
        id: segment.id,
        color: segment.color,
        share: (segment.value / total) * 100,
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => segment !== null);

  // A tiny non-zero value must stay visible, so each segment gets a floor —
  // but the floors are taken OUT of the segments that can afford it. Flooring
  // every segment independently overflows the bar (3 tiny + 1 huge measured
  // 106%), and a bar wider than its track is worse than a missing speck.
  const floorTotal = visible.length * MIN_SEGMENT_PCT;
  const surplus = Math.max(0, 100 - floorTotal);
  const slack = Math.max(
    0,
    visible.reduce(
      (sum, segment) => sum + Math.max(0, segment.share - MIN_SEGMENT_PCT),
      0,
    ),
  );
  const widths = visible.map(segment => {
    const room = Math.max(0, segment.share - MIN_SEGMENT_PCT);
    const claim = slack > 0 ? (room / slack) * surplus : 0;
    return Math.min(100, MIN_SEGMENT_PCT + claim);
  });
  const drawn = visible
    .map((segment, index) => ({...segment, width: widths[index]}))
    .filter(segment => segment.width > 0);

  const bar = (
    <HStack
      gap={gap}
      height={height}
      width="100%"
      vAlign="stretch"
      role="img"
      aria-label={label}
      style={
        total > 0
          ? undefined
          : {background: trackColor, borderRadius: 'var(--radius-inner)'}
      }>
      {drawn.map(segment => (
        <StackItem
          key={segment.id}
          style={{...segmentStyle, flexBasis: `${segment.width}%`, background: segment.color}}
        />
      ))}
    </HStack>
  );

  if (!hasValueLabel) return bar;

  return (
    <VStack gap={1}>
      {bar}
      <Text type="supporting" color="secondary" hasTabularNumbers>
        {formatValue(total)}
      </Text>
    </VStack>
  );
}
