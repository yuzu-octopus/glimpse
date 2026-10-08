import { type ModelReleasesConfig, modelReleasesSchema } from "../../shared/widgets/model-releases";
import type { ModelReleaseItem, ModelReleasesData } from "../../shared/widgets/payloads";
import { fetchJson, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

const AITRACKER_API = "https://live.aitracker.bot/api/events";

interface UpstreamModelDetail {
	model?: unknown;
	displayName?: unknown;
	organization?: unknown;
	author?: unknown;
	description?: unknown;
	evidenceUrl?: unknown;
	publishedAt?: unknown;
}

interface UpstreamEvent {
	id?: unknown;
	sourceName?: unknown;
	topicLabel?: unknown;
	tags?: unknown;
	url?: unknown;
	detectedAt?: unknown;
	title?: unknown;
	summary?: unknown;
	addedModels?: unknown;
	modelDetails?: unknown;
}

interface UpstreamResponse {
	events?: unknown;
}

function str(val: unknown, fallback = ""): string {
	return typeof val === "string" ? val.trim() : fallback;
}

function cleanDescription(raw: string): string {
	if (!raw) return "";
	// Strip repeated newlines and excessive whitespace
	const oneLine = raw
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
	return oneLine.length > 200 ? `${oneLine.slice(0, 197).trimEnd()}…` : oneLine;
}

export function parseModelReleases(data: unknown, cfg: ModelReleasesConfig): ModelReleaseItem[] {
	if (!data || typeof data !== "object") return [];
	const raw = data as UpstreamResponse;
	if (!Array.isArray(raw.events)) return [];

	const items: ModelReleaseItem[] = [];
	const labFilters = cfg.labs?.map((l) => l.toLowerCase());

	for (const e of raw.events as UpstreamEvent[]) {
		const id = str(e.id);
		if (!id) continue;

		const details = Array.isArray(e.modelDetails) ? (e.modelDetails as UpstreamModelDetail[]) : [];
		const firstDetail = details[0];
		const addedModels = Array.isArray(e.addedModels) ? (e.addedModels as unknown[]) : [];

		const modelName =
			str(firstDetail?.displayName) ||
			str(firstDetail?.model) ||
			str(addedModels[0]) ||
			str(e.title, "Unknown model");

		const author =
			str(firstDetail?.organization) || str(firstDetail?.author) || str(e.sourceName, "AI Lab");

		if (labFilters && labFilters.length > 0) {
			const authorLower = author.toLowerCase();
			const modelLower = modelName.toLowerCase();
			const matches = labFilters.some((f) => authorLower.includes(f) || modelLower.includes(f));
			if (!matches) continue;
		}

		const description = cleanDescription(
			str(firstDetail?.description) || str(e.summary) || str(e.title),
		);

		const url = str(firstDetail?.evidenceUrl) || str(e.url, "https://live.aitracker.bot");
		const publishedAt =
			str(firstDetail?.publishedAt) || str(e.detectedAt, new Date().toISOString());
		const topicLabel = str(e.topicLabel, "Models");
		const tags = Array.isArray(e.tags)
			? e.tags.filter((t): t is string => typeof t === "string")
			: [];

		items.push({
			id,
			model: modelName,
			author,
			description,
			url,
			publishedAt,
			topicLabel,
			tags,
		});

		if (items.length >= cfg.limit) break;
	}

	return items;
}

registerWidget("model-releases", async (ctx, config): Promise<ModelReleasesData> => {
	const cfg = modelReleasesSchema.parse(config);
	const retry = retryOptionsFrom(cfg);
	const limit = Math.max(cfg.limit * 2, 20);

	const url = `${AITRACKER_API}?topic=models&limit=${limit}&view=lite`;
	const data = await fetchJson<UpstreamResponse>(ctx, url, {}, retry);
	const items = parseModelReleases(data, cfg);

	return { items };
});
