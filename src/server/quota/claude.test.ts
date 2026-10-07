import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { fetchClaudeUsage } from "./claude";

describe("fetchClaudeUsage", () => {
	it("maps both windows, in order, with their reset times", async () => {
		const payload = {
			five_hour: { utilization: 42, reset_at: "2026-01-01T00:00:00Z" },
			seven_day: { utilization: 10 },
			// A top-level key with no underscore is not a usage window; the widget
			// would render a bar for it if the filter were dropped.
			account: { utilization: 99 },
		};
		const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
		const ctx = {
			fetch: f as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		};
		const snap = await fetchClaudeUsage({ token: "tok" }, ctx as never);
		expect(snap.windows).toEqual([
			{
				usedPercent: 42,
				windowMinutes: 300,
				resetsAt: Date.parse("2026-01-01T00:00:00Z"),
				label: "five_hour",
			},
			// No reset_at at all: the bar must render with no countdown, not NaN.
			{ usedPercent: 10, windowMinutes: 10080, resetsAt: 0, label: "seven_day" },
		]);
	});

	it("prefers the snake_case percent and epoch-seconds reset the API also sends", async () => {
		const payload = { five_hour: { used_percent: 7, resetAt: 1735401600 } };
		const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
		const ctx = {
			fetch: f as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		};
		const snap = await fetchClaudeUsage({ token: "tok" }, ctx as never);
		expect(snap.windows[0].usedPercent).toBe(7);
		// Epoch seconds, not milliseconds: a missing ×1000 renders a reset date
		// in January 1970.
		expect(snap.windows[0].resetsAt).toBe(1735401600 * 1000);
	});
});
