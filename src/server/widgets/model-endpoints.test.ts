import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./model-endpoints";
import type { ModelEndpointsData } from "../../shared/widgets/payloads";
import { endpointHealth } from "./model-endpoints";

const OPENAI = "openai/gpt-4o";
const CLAUDE = "anthropic/claude-sonnet-4.5";

/** Shapes copied from live responses: status 0 healthy, -2 deranked with
 * visibly worse uptime, -5 excluded from routing with a 0% day. */
function body(id: string, name: string, endpoints: Record<string, unknown>[]) {
	return { data: { id, name, architecture: {}, endpoints } };
}

const ENDPOINTS: Record<string, unknown> = {
	[OPENAI]: body(OPENAI, "OpenAI: GPT-4o", [
		{
			provider_name: "Azure",
			tag: "azure",
			status: 0,
			uptime_last_5m: 100,
			uptime_last_30m: 99.80740423710678,
			uptime_last_1d: 99.90405326023105,
		},
		{
			provider_name: "Fireworks",
			tag: "fireworks/ai-fp8",
			status: -2,
			uptime_last_5m: 96.65211062590974,
			uptime_last_30m: 94.72660053565606,
			uptime_last_1d: 89.41,
		},
		{
			provider_name: "DeepSeek",
			tag: "deepseek",
			status: -5,
			uptime_last_5m: null,
			uptime_last_30m: null,
			uptime_last_1d: 0,
		},
	]),
	[CLAUDE]: body(CLAUDE, "Anthropic: Claude Sonnet 4.5", [
		{
			provider_name: "AWS Bedrock",
			tag: "amazon-bedrock",
			status: 0,
			uptime_last_5m: 100,
			uptime_last_30m: 99.9,
			uptime_last_1d: 99.99,
		},
	]),
};

function makeCtx(
	fixtures: Record<string, unknown> = ENDPOINTS,
	fail: string[] = [],
): {
	ctx: WidgetFetchContext;
	calls: string[];
} {
	const calls: string[] = [];
	const fetchMock = vi.fn(async (url: string) => {
		calls.push(url);
		if (fail.some((f) => url.includes(f))) throw new Error("upstream 502");
		const body =
			fixtures[url.replace("https://openrouter.ai/api/v1/models/", "").replace(/\/endpoints$/, "")];
		return new Response(JSON.stringify(body));
	});
	return {
		ctx: {
			fetch: fetchMock as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		},
		calls,
	};
}

const fetcher = () => serverWidgets.get("model-endpoints")!;
const run = (ctx: WidgetFetchContext, config: Record<string, unknown>) =>
	fetcher()(ctx, config) as Promise<ModelEndpointsData>;

describe("model-endpoints fetcher", () => {
	it("maps status codes onto health, worst first", async () => {
		const { ctx } = makeCtx();
		const out = await run(ctx, { type: "model-endpoints", models: [OPENAI] });
		expect(out.rows.map((r) => [r.provider, r.health])).toEqual([
			["DeepSeek", "down"],
			["Fireworks", "degraded"],
			["Azure", "up"],
		]);
		expect(out.total).toBe(3);
	});

	it("reads the uptime windows and keeps the raw status", async () => {
		const { ctx } = makeCtx();
		const [row] = (await run(ctx, { type: "model-endpoints", models: [OPENAI], limit: 1 })).rows;
		expect(row.status).toBe(-5);
		expect(row.uptime1d).toBe(0);
		// No sample upstream must render as null, not as a zero uptime.
		expect(row.uptime5m).toBeNull();
		expect(row.uptime30m).toBeNull();
		expect(row.url).toBe("https://openrouter.ai/openai/gpt-4o");
	});

	it("caps rows after sorting, so the unhealthy tail is the one that is cut", async () => {
		const { ctx } = makeCtx();
		const out = await run(ctx, { type: "model-endpoints", models: [OPENAI, CLAUDE], limit: 2 });
		expect(out.rows).toHaveLength(2);
		expect(out.total).toBe(4);
		expect(out.rows.map((r) => r.health)).toEqual(["down", "degraded"]);
	});

	it("rolls endpoints up per model, worst health winning", async () => {
		const { ctx } = makeCtx();
		const out = await run(ctx, { type: "model-endpoints", models: [OPENAI, CLAUDE] });
		const gpt = out.models.find((m) => m.model === OPENAI)!;
		expect(gpt).toMatchObject({
			providers: 3,
			up: 1,
			degraded: 1,
			down: 1,
			health: "down",
			unavailable: false,
		});
		const claude = out.models.find((m) => m.model === CLAUDE)!;
		expect(claude).toMatchObject({ providers: 1, up: 1, health: "up", unavailable: false });
		expect(out).toMatchObject({ checked: 2, requested: 2, failed: [] });
	});

	it("marks a model unavailable when no endpoint is up", async () => {
		const { ctx } = makeCtx({
			[CLAUDE]: body(CLAUDE, "Anthropic: Claude Sonnet 4.5", [
				{ provider_name: "Venice", tag: "venice", status: -5, uptime_last_1d: 0 },
			]),
		});
		const out = await run(ctx, { type: "model-endpoints", models: [CLAUDE] });
		expect(out.models[0]).toMatchObject({ unavailable: true, up: 0, health: "down" });
	});

	it("matches a quantised tag, and a bare provider is not a string prefix", async () => {
		const { ctx } = makeCtx();
		const byTag = await run(ctx, {
			type: "model-endpoints",
			models: [OPENAI],
			provider: "fireworks",
		});
		expect(byTag.rows.map((r) => r.provider)).toEqual(["Fireworks"]);

		// 'fire' must not sweep up every 'fire*' provider, and must not match
		// 'amazon-bedrock' either.
		const { ctx: ctx2 } = makeCtx();
		const byPrefix = await run(ctx2, {
			type: "model-endpoints",
			models: [OPENAI],
			provider: "fire",
		});
		expect(byPrefix.rows).toEqual([]);
		expect(byPrefix.models[0]).toMatchObject({ providers: 0, health: "unknown" });
	});

	it("unhealthy-only hides fully up endpoints but still counts them in total", async () => {
		const { ctx } = makeCtx();
		const out = await run(ctx, {
			type: "model-endpoints",
			models: [OPENAI, CLAUDE],
			"unhealthy-only": true,
		});
		expect(out.rows.every((r) => r.health !== "up")).toBe(true);
		// The all-healthy model contributes nothing to the filtered total.
		expect(out.total).toBe(2);
		expect(out.models).toHaveLength(2);
	});

	it("keeps the healthy models when one model request fails", async () => {
		const { ctx } = makeCtx(ENDPOINTS, [CLAUDE]);
		const out = await run(ctx, { type: "model-endpoints", models: [OPENAI, CLAUDE] });
		expect(out.failed).toEqual([CLAUDE]);
		expect(out.checked).toBe(1);
		expect(out.rows.every((r) => r.model === OPENAI)).toBe(true);
	});

	it("fetches one request per model, keeping the vendor slash unescaped", async () => {
		const { ctx, calls } = makeCtx();
		await run(ctx, { type: "model-endpoints", models: [OPENAI, CLAUDE, OPENAI] });
		// A duplicated slug is one request, and a %2F separator 404s upstream.
		expect(calls).toEqual([
			"https://openrouter.ai/api/v1/models/openai/gpt-4o/endpoints",
			"https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-4.5/endpoints",
		]);
	});
});

describe("endpointHealth", () => {
	it("reads 0 as healthy, mid negatives as degraded, and hard negatives as down", () => {
		expect(endpointHealth(0)).toBe("up");
		expect(endpointHealth(-2)).toBe("degraded");
		expect(endpointHealth(-5)).toBe("down");
		expect(endpointHealth(-9)).toBe("down");
	});

	it("treats a missing status as unknown, never as healthy", () => {
		expect(endpointHealth(null)).toBe("unknown");
	});
});
