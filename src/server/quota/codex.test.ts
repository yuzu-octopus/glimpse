import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { fetchCodexUsage } from "./codex";

function makeCtx(route: Record<string, unknown>) {
	const fetchMock = vi.fn(
		async (_url: string, _init?: RequestInit) =>
			new Response(JSON.stringify(route["https://chatgpt.com/backend-api/wham/usage"]), {
				status: 200,
			}),
	);
	return {
		fetch: fetchMock as unknown as typeof fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
		fetchMock,
	};
}

describe("fetchCodexUsage", () => {
	it("parses primary + secondary windows and plan", async () => {
		const ctx = makeCtx({
			"https://chatgpt.com/backend-api/wham/usage": {
				plan_type: "pro",
				rate_limit: {
					primary_window: { used_percent: 15, reset_at: 1735401600, limit_window_seconds: 18000 },
					secondary_window: { used_percent: 5, reset_at: 1735920000, limit_window_seconds: 604800 },
				},
			},
		});
		const snap = await fetchCodexUsage({ token: "tok", accountId: "acc" }, ctx as never);
		expect(snap.plan).toBe("pro");
		// Both windows, and the seconds→minutes conversion: `limit_window_seconds`
		// is 18000 and 604800, and the bar must count down in 300 and 10080
		// minutes. Dropping the /60 renders a five-hour window as a 12-day one.
		expect(snap.windows).toEqual([
			{ usedPercent: 15, windowMinutes: 300, resetsAt: 1735401600 * 1000, label: "primary" },
			{ usedPercent: 5, windowMinutes: 10080, resetsAt: 1735920000 * 1000, label: "secondary" },
		]);
		// Without the account header the usage endpoint answers for the wrong
		// account rather than erroring, so it is a silent wrong-number bug.
		expect((ctx.fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
			"ChatGPT-Account-ID": "acc",
		});
	});

	it("throws a sanitized message on 401 without retrying", async () => {
		const f = vi.fn(async () => new Response("Unauthorized", { status: 401 }));
		const ctx = {
			fetch: f as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		};
		const err = await fetchCodexUsage({ token: "sk-super-secret" }, ctx as never).catch(
			(e: Error) => e,
		);
		expect(err).toBeInstanceOf(Error);
		// 401 is not retryable: a bad token retried four times just delays the
		// error the user has to see.
		expect(f).toHaveBeenCalledOnce();
		expect((err as Error).message).toMatch(/^HTTP 401 for https:\/\/chatgpt\.com/);
		// The token reaches the Authorization header and must reach nothing else.
		expect((err as Error).message).not.toMatch(/sk-super-secret/);
	});
});
