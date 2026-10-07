import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const TIMER_DEFAULTS = { duration: "25m" } as const;
export const TIMER_PREF: Pref = {
	cols: 3,
	rows: 3,
	resizable: false,
	priority: 5,
	zone: "sidebar",
	preferredWidth: 320,
	preferredHeight: 300,
};
/** A filled dial in a 300px tile. Closest of the four; three hairlines
 * promise a paragraph, and a real `dial` shape is out of scope here. */
export const TIMER_SKELETON: SkeletonShape = "chart";

/** Duration string: one or more unit groups ("25m", "1h", "90s", "1h30m",
 * "1h 30m") or "mm:ss[:ss]".
 *
 * The unit alternative is a `+` group, not a single group. As a single group
 * it matched exactly one `\d+\s*(h|m|s)`, so it rejected `1h30m` — the exact
 * form the message printed beside it offered, and the form `parseDuration`
 * below has always read correctly via `matchAll`. A user was told to write a
 * string the schema refused.
 *
 * The schema stays stricter than the parser on purpose. `parseDuration` sums
 * whatever unit groups it finds and ignores everything else, so it would read
 * `1h nonsense` as 3600; anchoring both alternatives rejects that instead of
 * silently running the wrong duration. */
const durationString = z
	.string()
	.regex(
		/^\s*(?:(?:\d+\s*[hms]\s*)+|\d{1,2}:\d{2}(?::\d{2})?)\s*$/,
		'expected "25m", "1h30m", "90s" or "mm:ss"',
	)
	.default(() => TIMER_DEFAULTS.duration);

export const timerSchema = z.object({
	type: z.literal("timer"),
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
		const parts = s.split(":").map(Number);
		return parts.length === 3
			? parts[0] * 3600 + parts[1] * 60 + parts[2]
			: parts[0] * 60 + parts[1];
	}
	let total = 0;
	for (const m of s.matchAll(/(\d+)\s*(h|m|s)/g)) {
		const n = Number(m[1]);
		total += m[2] === "h" ? n * 3600 : m[2] === "m" ? n * 60 : n;
	}
	return total;
}

/** Format seconds as h:mm:ss / m:ss. */
export function formatDuration(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	const ss = String(sec).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
