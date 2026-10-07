import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./network";
import type { NetworkData } from "../../shared/widgets/payloads";

const PUBLIC_IP = "https://api.ipify.org?format=json";

function makeCtx(handler: (url: string) => Response): WidgetFetchContext {
	return {
		fetch: vi.fn(async (url: string) => handler(url)) as unknown as typeof fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	};
}

/** The public-IP lookup always answers; the target probe answers `status`. */
async function probe(status: number): Promise<NetworkData> {
	const ctx = makeCtx((url) =>
		url === PUBLIC_IP
			? new Response(JSON.stringify({ ip: "203.0.113.7" }), { status: 200 })
			: new Response("", { status }),
	);
	return (await serverWidgets.get("network")!(ctx, { type: "network" })) as NetworkData;
}

describe("network fetcher", () => {
	it("records a reading from a target that answers 2xx", async () => {
		const data = await probe(200);
		expect(typeof data.ttfbMs).toBe("number");
		expect(data.ttfbMs).toBeGreaterThanOrEqual(0);
		expect(data.publicIp).toBe("203.0.113.7");
	});

	it("records no reading from a target that answers with an error status", async () => {
		// A 503 is the quickest answer a broken target can give, so a timing
		// taken around it reads as the best link on the dashboard.
		const data = await probe(503);
		expect(data.ttfbMs).toBeNull();
	});

	it("records no reading from a target that never connects", async () => {
		const ctx = makeCtx((url) => {
			if (url === PUBLIC_IP)
				return new Response(JSON.stringify({ ip: "203.0.113.7" }), { status: 200 });
			throw new TypeError("fetch failed");
		});
		const data = (await serverWidgets.get("network")!(ctx, { type: "network" })) as NetworkData;
		expect(data.ttfbMs).toBeNull();
	});
});
