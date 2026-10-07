import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../../cache";
import { fetchTableRow, tableRow } from "./providerTable";

function ctx(payload: unknown) {
	const f = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
	return {
		fetch: f as unknown as typeof fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	} as never;
}

describe("api providers", () => {
	it("OpenRouter maps the remaining credit as the balance and the usage as a bar", async () => {
		const snap = await fetchTableRow(
			tableRow("openrouter"),
			{ token: "sk-or-" },
			ctx({ data: { credits: { total_credits: 10, total_usage: 3 } } }),
		);
		expect(snap.provider).toBe("openrouter");
		// The balance is the number the widget leads with: 10 granted, 3 spent.
		expect(snap.balance).toBe(7);
		expect(snap.windows[0].usedPercent).toBeCloseTo(30);
	});
	it("OpenRouter clamps an over-quota key at 100%", async () => {
		// usage > credits means the account is in the hole; an unclamped bar
		// renders a DataBar past its track.
		const snap = await fetchTableRow(
			tableRow("openrouter"),
			{ token: "sk-or-" },
			ctx({ data: { credits: { total_credits: 10, total_usage: 14 } } }),
		);
		expect(snap.balance).toBe(-4);
		expect(snap.windows[0].usedPercent).toBe(100);
	});
	it("DeepSeek picks the USD balance out of a multi-currency response", async () => {
		// A naive balance_infos[0] would report the EUR figure.
		const snap = await fetchTableRow(
			tableRow("deepseek"),
			{ token: "sk-" },
			ctx({
				balance_infos: [
					{ currency: "EUR", total_balance: 99, topped_up_balance: 99 },
					{ currency: "USD", total_balance: 10, topped_up_balance: 6 },
				],
			}),
		);
		expect(snap.balance).toBe(10);
	});
	it("DeepSeek falls back to the first entry when there is no USD one", async () => {
		const snap = await fetchTableRow(
			tableRow("deepseek"),
			{ token: "sk-" },
			ctx({ balance_infos: [{ currency: "EUR", total_balance: 99, topped_up_balance: 99 }] }),
		);
		expect(snap.balance).toBe(99);
	});
	it("DeepSeek reports 0 rather than NaN for an empty balance list", async () => {
		const snap = await fetchTableRow(
			tableRow("deepseek"),
			{ token: "sk-" },
			ctx({ balance_infos: [] }),
		);
		expect(snap.balance).toBe(0);
	});
	it("Moonshot maps available balance", async () => {
		const snap = await fetchTableRow(
			tableRow("moonshot"),
			{ token: "sk-" },
			ctx({ data: { available_balance: 5.5 } }),
		);
		expect(snap.balance).toBe(5.5);
	});
});
