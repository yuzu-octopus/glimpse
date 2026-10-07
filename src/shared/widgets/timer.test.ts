import { describe, expect, it } from "vitest";
import { parseDuration, TIMER_DEFAULTS, timerSchema } from "./timer";

/** `duration` through the real schema, so a form that fails validation here
 * would fail the same way in a user's config. */
function parseDurationField(value: unknown) {
	return timerSchema.safeParse({ type: "timer", duration: value });
}

describe("timer duration schema", () => {
	it.each([
		["25m", 1500],
		["1h", 3600],
		["90s", 90],
		["1h30m", 5400],
		["1h 30m", 5400],
		["1h30m15s", 5415],
		["5:30", 330],
		["1:05:30", 3930],
		["  25m  ", 1500],
	])("accepts %s, and the parser reads it as the same duration", (value, seconds) => {
		const result = parseDurationField(value);
		expect(result.success).toBe(true);
		expect(parseDuration(value)).toBe(seconds);
	});

	it.each([
		["a bare number with no unit", "25"],
		["an unknown unit", "5x"],
		["a unit group with trailing text", "1h nonsense"],
		["a unit group with a bad tail", "1h30x"],
		["an empty string", ""],
		["only a colon", ":30"],
	])("rejects %s", (_label, value) => {
		expect(parseDurationField(value).success).toBe(false);
	});

	it("defaults an absent duration rather than failing", () => {
		const result = timerSchema.safeParse({ type: "timer" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.duration).toBe(TIMER_DEFAULTS.duration);
	});
});
