import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../../cache";
import { fetchTableRow, tableRow } from "./providerTable";

function ctxWith(handler: (url: string, init?: RequestInit) => Response) {
	const f = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
	return {
		fetch: f as unknown as typeof fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
		f,
	} as const;
}

describe("web providers", () => {
	it("Cursor sends Cookie + CSRF and maps usage", async () => {
		const { f, ...ctx } = ctxWith((_url, init) => {
			const h = init?.headers as Record<string, string>;
			expect(h.Cookie).toContain("WorkosCursorSessionToken");
			// A missing csrftoken regex match drops the header silently and the
			// request 403s at the provider, not here.
			expect(h["X-CSRFTOKEN"]).toBe("xyz");
			return new Response(JSON.stringify({ usage: { usedPercent: 40, resetAt: 1767225600000 } }), {
				status: 200,
			});
		});
		const snap = await fetchTableRow(
			tableRow("cursor"),
			{ token: "WorkosCursorSessionToken=abc; csrftoken=xyz" },
			ctx as never,
		);
		expect(snap.provider).toBe("cursor");
		expect(snap.windows[0].usedPercent).toBe(40);
		// A fixed epoch, not Date.now(): the value is passthrough, so the test
		// must not be clock-dependent.
		expect(snap.windows[0].resetsAt).toBe(1767225600000);
		expect(f).toHaveBeenCalledOnce();
	});

	it("Perplexity computes balance and usage from the credit split", async () => {
		// recurring 100 + bonus 20 = 120 granted, 0 spent. `toBeDefined()` would
		// pass with the arithmetic inverted.
		const spent = await fetchTableRow(
			tableRow("perplexity"),
			{ token: "session=tok" },
			ctxWith(
				() =>
					new Response(JSON.stringify({ recurringCredits: 100, bonusCredits: 20 }), {
						status: 200,
					}),
			) as never,
		);
		expect(spent.balance).toBe(120);
		expect(spent.windows[0].usedPercent).toBe(0);
	});

	it("Perplexity counts purchased credits toward the total but not the balance", async () => {
		// Purchased credits raise the ceiling (the bar), not what is left.
		const snap = await fetchTableRow(
			tableRow("perplexity"),
			{ token: "session=tok" },
			ctxWith(
				() =>
					new Response(
						JSON.stringify({ recurringCredits: 100, bonusCredits: 20, purchasedCredits: 80 }),
						{
							status: 200,
						},
					),
			) as never,
		);
		expect(snap.balance).toBe(120);
		expect(snap.windows[0].usedPercent).toBe(40);
	});
});
