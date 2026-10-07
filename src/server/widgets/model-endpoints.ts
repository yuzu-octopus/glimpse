import { modelEndpointsSchema } from "../../shared/widgets/model-endpoints";
import type {
	EndpointHealth,
	ModelEndpointModel,
	ModelEndpointRow,
	ModelEndpointsData,
} from "../../shared/widgets/payloads";
import { fetchJson, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

const API = "https://openrouter.ai/api/v1";

interface UpstreamEndpoint {
	provider_name?: unknown;
	tag?: unknown;
	status?: unknown;
	uptime_last_5m?: unknown;
	uptime_last_30m?: unknown;
	uptime_last_1d?: unknown;
}

interface UpstreamModel {
	id?: unknown;
	name?: unknown;
	endpoints?: unknown;
}

interface UpstreamBody {
	data?: UpstreamModel | null;
}

/** Worst-first, so the cap keeps the rows worth looking at. */
const HEALTH_RANK: Record<EndpointHealth, number> = {
	down: 0,
	degraded: 1,
	unknown: 2,
	up: 3,
};

/**
 * OpenRouter's per-endpoint `status` is a routing signal, not an HTTP code:
 * `0` is healthy, and negatives mark a provider OpenRouter has backed away
 * from. Observed on the live API: `0` for healthy, `-2` for a provider with
 * visibly worse uptime (still routed), and `-5` alongside `uptime_last_1d: 0`
 * (excluded from routing). Anything unrecognised stays `unknown` rather than
 * being forced into a healthy bucket.
 */
export function endpointHealth(status: number | null): EndpointHealth {
	if (status === null) return "unknown";
	if (status === 0) return "up";
	if (status <= -5) return "down";
	return "degraded";
}

function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown, fallback: string): string {
	return typeof value === "string" && value.length > 0 ? value : fallback;
}

registerWidget("model-endpoints", async (ctx, config): Promise<ModelEndpointsData> => {
	const cfg = modelEndpointsSchema.parse(config);
	const retry = retryOptionsFrom(cfg);
	const wanted = [...new Set(cfg.models)];

	// The slug is a two-segment path, not one segment: percent-encoding the
	// whole thing turns the separator into %2F and OpenRouter 404s the model.
	// Encode each segment, keep the slashes.
	const paths = wanted.map((slug) => slug.split("/").map(encodeURIComponent).join("/"));

	const settled = await Promise.allSettled(
		paths.map(async (path) => {
			const url = `${API}/models/${path}/endpoints`;
			return ctx.singleflight.run(url, async () => {
				const body = await fetchJson<UpstreamBody>(ctx, url, {}, retry);
				return body?.data ?? null;
			});
		}),
	);

	const provider = cfg.provider?.toLowerCase();
	const models: ModelEndpointModel[] = [];
	const rows: ModelEndpointRow[] = [];
	const failed: string[] = [];
	let checked = 0;

	settled.forEach((result, i) => {
		const slug = wanted[i];
		if (result.status === "rejected") {
			// One unreachable model must not blank out the other nine.
			failed.push(slug);
			return;
		}
		const data = result.value;
		if (!data) {
			failed.push(slug);
			return;
		}
		checked += 1;

		const name = str(data.name, slug);
		const listed = Array.isArray(data.endpoints) ? (data.endpoints as UpstreamEndpoint[]) : [];
		// A tag is either the bare provider (`azure`) or the provider plus the
		// quantisation (`fireworks/ai-fp8`); the display name is accepted too, so
		// `provider: Fireworks` works without a trip to the docs.
		const endpoints = provider
			? listed.filter(
					(e) =>
						str(e.tag, "").toLowerCase().split("/")[0] === provider ||
						str(e.provider_name, "").toLowerCase() === provider,
				)
			: listed;
		const pageUrl = `https://openrouter.ai/${slug.split("/").map(encodeURIComponent).join("/")}`;

		const counts = { up: 0, degraded: 0, down: 0, unknown: 0 };
		for (const e of endpoints) {
			const health = endpointHealth(num(e.status));
			counts[health] += 1;
			rows.push({
				model: slug,
				modelName: name,
				provider: str(e.provider_name, str(e.tag, "unknown")),
				tag: str(e.tag, ""),
				health,
				status: num(e.status),
				uptime5m: num(e.uptime_last_5m),
				uptime30m: num(e.uptime_last_30m),
				uptime1d: num(e.uptime_last_1d),
				url: pageUrl,
			});
		}

		// A model's own health is its worst endpoint, not an average: one live
		// provider still means the model is routable, so the rollup only reads
		// `up` when every endpoint is up. Only buckets with endpoints in them
		// vote — an empty `down: 0` is not evidence of anything.
		const ranked = (Object.keys(counts) as EndpointHealth[])
			.filter((h) => counts[h] > 0)
			.sort((a, b) => HEALTH_RANK[a] - HEALTH_RANK[b]);
		const health: EndpointHealth = ranked[0] ?? "unknown";
		models.push({
			model: slug,
			name,
			health,
			providers: endpoints.length,
			up: counts.up,
			degraded: counts.degraded,
			down: counts.down,
			unavailable: endpoints.length > 0 && counts.up === 0,
			url: pageUrl,
		});
	});

	// Unhealthy rows first, and worst uptime first inside a health class, so
	// `limit` truncates the boring tail rather than the signal.
	rows.sort(
		(a, b) =>
			HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
			(a.uptime1d ?? -1) - (b.uptime1d ?? -1) ||
			a.model.localeCompare(b.model) ||
			a.provider.localeCompare(b.provider),
	);

	const visible = cfg["unhealthy-only"] ? rows.filter((r) => r.health !== "up") : rows;

	return {
		models,
		rows: visible.slice(0, cfg.limit),
		total: visible.length,
		checked,
		requested: wanted.length,
		failed,
	};
});
