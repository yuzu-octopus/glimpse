import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../shared/config";
import { Singleflight, TtlCache } from "./cache";
import type { WidgetFetchContext } from "./widgets/registry";

const mocks = vi.hoisted(() => ({
	buildPagePayload: vi.fn(async () => ({ ok: true })),
	getConfig: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
	const mod = await importOriginal<typeof import("./api")>();
	return { ...mod, buildPagePayload: mocks.buildPagePayload };
});

vi.mock("./config", async (importOriginal) => {
	const mod = await importOriginal<typeof import("./config")>();
	return { ...mod, getConfig: mocks.getConfig };
});

import { warmCache } from "./warmup";

function makeCtx(): WidgetFetchContext {
	return {
		fetch: globalThis.fetch.bind(globalThis) as typeof fetch,
		env: {} as Record<string, string>,
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	};
}

const okConfig = {
	ok: true as const,
	errors: [] as string[],
	files: [] as string[],
	config: {
		pages: [
			{ name: "A", slug: "a", columns: [{ size: "full" as const, widgets: [{ type: "clock" }] }] },
			{ name: "B", slug: "b", columns: [{ size: "full" as const, widgets: [{ type: "clock" }] }] },
		],
		theme: undefined,
	} as unknown as Config & { pages: Array<{ name: string; slug: string; columns: unknown[] }> },
};

describe("warmCache", () => {
	beforeEach(() => {
		mocks.buildPagePayload.mockReset();
		mocks.buildPagePayload.mockResolvedValue({} as never);
		mocks.getConfig.mockReset();
	});

	it("builds every page once", async () => {
		mocks.getConfig.mockReturnValue(okConfig);
		const ctx = makeCtx();
		await warmCache(ctx);
		expect(mocks.buildPagePayload).toHaveBeenCalledTimes(2);
		expect(mocks.buildPagePayload).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "a" }),
			ctx,
		);
		expect(mocks.buildPagePayload).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "b" }),
			ctx,
		);
	});

	it("never rejects when a page build fails", async () => {
		mocks.getConfig.mockReturnValue(okConfig);
		mocks.buildPagePayload.mockRejectedValueOnce(new Error("boom"));
		mocks.buildPagePayload.mockResolvedValueOnce({} as never);
		const ctx = makeCtx();
		await expect(warmCache(ctx)).resolves.toBeUndefined();
		expect(mocks.buildPagePayload).toHaveBeenCalledTimes(2);
	});

	it("never has more than WARMUP_CONCURRENCY pages in flight", async () => {
		// The cap is the entire reason warmCache exists — unbounded fan-out at
		// boot spikes upstream connections and RSS. A mock call count cannot see
		// it, so drive the fetcher and track real concurrency.
		const pages = Array.from({ length: 20 }, (_, i) => ({
			name: `P${i}`,
			slug: `p${i}`,
			columns: [{ size: "full" as const, widgets: [{ type: "clock" }] }],
		}));
		mocks.getConfig.mockReturnValue({
			ok: true as const,
			errors: [],
			files: [],
			config: { pages } as unknown as Config,
		});
		let inFlight = 0;
		let maxInFlight = 0;
		// Every page blocks on one gate, so the whole pool is scheduled and parked
		// before anything completes. No timers: the pool's continuations are
		// microtasks, and 200 turns is far more than 20 pages can need.
		const gate = Promise.withResolvers<void>();
		mocks.buildPagePayload.mockImplementation(async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await gate.promise;
			inFlight -= 1;
			return {} as never;
		});
		const warm = warmCache(makeCtx());
		for (let turn = 0; turn < 200; turn += 1) await Promise.resolve();
		gate.resolve();
		await warm;
		expect(mocks.buildPagePayload).toHaveBeenCalledTimes(20);
		// Exactly the declared pool size: 6, not fewer. Dropping the cap to 1
		// serialises a 20-page boot and is as much a regression as removing it.
		expect(maxInFlight).toBe(6);
	});

	it("does nothing when config is not ok", async () => {
		mocks.getConfig.mockReturnValue({ ok: false as const, errors: ["bad"], files: [] });
		const ctx = makeCtx();
		await warmCache(ctx);
		expect(mocks.buildPagePayload).not.toHaveBeenCalled();
	});

	it("does nothing when config has no pages", async () => {
		mocks.getConfig.mockReturnValue({
			ok: true as const,
			errors: [],
			files: [],
			config: { pages: [] } as never,
		});
		const ctx = makeCtx();
		await warmCache(ctx);
		expect(mocks.buildPagePayload).not.toHaveBeenCalled();
	});

	it("clears stale cache prefixes before warming", async () => {
		mocks.getConfig.mockReturnValue(okConfig);
		const ctx = makeCtx();
		ctx.cache.set("a:0", "stale", 60_000);
		ctx.cache.set("a:head:0", "stale", 60_000);
		ctx.cache.set("b:0", "stale", 60_000);
		ctx.cache.set("other:0", "keep", 60_000);
		await warmCache(ctx);
		expect(ctx.cache.get("a:0")).toBeUndefined();
		expect(ctx.cache.get("a:head:0")).toBeUndefined();
		expect(ctx.cache.get("b:0")).toBeUndefined();
		expect(ctx.cache.get("other:0")).toBe("keep");
	});
});
