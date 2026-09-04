import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const TIMER_DEFAULTS = { duration: '25m' } as const;
export const TIMER_PREF: Pref = { cols: 3, rows: 3, resizable: false, priority: 5, zone: 'sidebar', preferredWidth: 320, preferredHeight: 300 };
export const TIMER_SKELETON: SkeletonShape = 'rows';

/** Duration string: minutes ("25m"), hours ("1h"), or "hh:mm[:ss]". */
const durationString = z
  .string()
  .regex(/^\s*(\d+\s*(h|m|s)|\d{1,2}:\d{2}(:\d{2})?)\s*$/, 'expected "25m", "1h30m", "90s" or "mm:ss"')
  .default(() => TIMER_DEFAULTS.duration);

export const timerSchema = z.object({
  type: z.literal('timer'),
  ...sharedWidgetFields,
  id: z.string().optional(),
  /** Default countdown duration (user-editable at runtime). */
  duration: durationString.optional(),
  /** Show the notepad scratch area. */
  notes: z.boolean().optional(),
});
export type TimerConfig = z.infer<typeof timerSchema>;

/** Parse a duration string to seconds. Exported for the renderer + tests. */
export function parseDuration(input: string): number {
  const s = input.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  let total = 0;
  for (const m of s.matchAll(/(\d+)\s*(h|m|s)/g)) {
    const n = Number(m[1]);
    total += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n;
  }
  return total;
}

/** Format seconds as h:mm:ss / m:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
