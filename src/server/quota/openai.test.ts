import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { fetchOpenaiUsage } from "./openai";

describe("fetchOpenaiUsage", () => {
	it("sums the cost buckets into a balance and labels the window", async () => {
		const costs = { data: [{ amount: { value: 1.0 } }, { amount: { value: 0.23 } }] };
		const urls: string[] = [];
		const f = vi.fn(async (url: string) => {
			urls.push(url);
			return new Response(JSON.stringify(url.includes("costs") ? costs : { data: [] }), {
				status: 200,
			});
		});
		const ctx = {
			fetch: f as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		};
		const snap = await fetchOpenaiUsage({ token: "adm", projectId: "proj" }, ctx as never);
		// The provider string is a hardcoded literal in the fetcher; the balance is
		// the number the widget actually renders.
		expect(snap.provider).toBe("openai");
		expect(snap.balance).toBe(1.23);
		// Both upstream calls carry the project scope, or the costs endpoint
		// returns the org-wide total instead of this project's.
		expect(urls).toEqual([
			"https://api.openai.com/v1/organization/costs?project_id=proj",
			"https://api.openai.com/v1/organization/usage/completions?project_id=proj",
		]);
	});

	it("reports a zero balance rather than NaN when no costs are returned", async () => {
		const urls: string[] = [];
		const f = vi.fn(async (url: string) => {
			urls.push(url);
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});
		const ctx = {
			fetch: f as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		};
		const snap = await fetchOpenaiUsage({ token: "adm", projectId: "p2" }, ctx as never);
		expect(snap.balance).toBe(0);
	});
});
