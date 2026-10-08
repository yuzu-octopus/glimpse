import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./model-releases";
import type { ModelReleasesData } from "../../shared/widgets/payloads";

function makeCtx(routes: Record<string, unknown>): {
	ctx: WidgetFetchContext;
	fetchMock: ReturnType<typeof vi.fn>;
} {
	const fetchMock = vi.fn(async (url: string) => {
		const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
		if (!hit) return new Response("{}", { status: 404 });
		return new Response(JSON.stringify(hit[1]), { status: 200 });
	});
	return {
		ctx: {
			fetch: fetchMock as unknown as typeof fetch,
			env: {},
			cache: new TtlCache(),
			singleflight: new Singleflight(),
		},
		fetchMock,
	};
}

const modelReleasesFetcher = () => {
	const fn = serverWidgets.get("model-releases");
	if (!fn) throw new Error("model-releases fetcher missing");
	return fn;
};

describe("model-releases fetcher", () => {
	it("parses events and extracts model details", async () => {
		const sampleResponse = {
			events: [
				{
					id: "event-1",
					title: "OpenAI added GPT-5",
					summary: "New frontier model announced with reasoning.",
					url: "https://openai.com/index/gpt-5",
					detectedAt: "2026-10-08T00:00:00.000Z",
					topicLabel: "Frontier",
					tags: ["models", "frontier"],
					modelDetails: [
						{
							model: "gpt-5",
							displayName: "GPT-5",
							organization: "OpenAI",
							description: "Frontier reasoning model.",
							evidenceUrl: "https://openai.com/index/gpt-5",
							publishedAt: "2026-10-08T00:00:00.000Z",
						},
					],
				},
				{
					id: "event-2",
					title: "Anthropic dropped Claude 4",
					summary: "New coding powerhouse.",
					url: "https://anthropic.com/news/claude-4",
					detectedAt: "2026-10-07T00:00:00.000Z",
					topicLabel: "Frontier",
					tags: ["models"],
					modelDetails: [
						{
							model: "claude-4",
							displayName: "Claude 4 Sonnet",
							organization: "Anthropic",
							description: "Autonomous reasoning agent.",
							evidenceUrl: "https://anthropic.com/news/claude-4",
							publishedAt: "2026-10-07T00:00:00.000Z",
						},
					],
				},
			],
		};

		const { ctx } = makeCtx({
			"https://live.aitracker.bot/api/events": sampleResponse,
		});

		const data = (await modelReleasesFetcher()(ctx, {
			type: "model-releases",
			limit: 5,
		})) as ModelReleasesData;

		expect(data.items).toHaveLength(2);
		expect(data.items[0].model).toBe("GPT-5");
		expect(data.items[0].author).toBe("OpenAI");
		expect(data.items[0].url).toBe("https://openai.com/index/gpt-5");
		expect(data.items[1].model).toBe("Claude 4 Sonnet");
		expect(data.items[1].author).toBe("Anthropic");
	});

	it("filters by configured labs", async () => {
		const sampleResponse = {
			events: [
				{
					id: "e1",
					modelDetails: [{ model: "m1", organization: "OpenAI" }],
				},
				{
					id: "e2",
					modelDetails: [{ model: "m2", organization: "Anthropic" }],
				},
				{
					id: "e3",
					modelDetails: [{ model: "m3", organization: "Meta" }],
				},
			],
		};

		const { ctx } = makeCtx({
			"https://live.aitracker.bot/api/events": sampleResponse,
		});

		const data = (await modelReleasesFetcher()(ctx, {
			type: "model-releases",
			limit: 10,
			labs: ["anthropic"],
		})) as ModelReleasesData;

		expect(data.items).toHaveLength(1);
		expect(data.items[0].model).toBe("m2");
		expect(data.items[0].author).toBe("Anthropic");
	});
});
