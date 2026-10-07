import { describe, expect, it } from "vitest";
import { modelEndpointsSchema } from "./model-endpoints";

describe("model-endpoints schema", () => {
	it("accepts a model list and defaults limit / unhealthy-only", () => {
		const cfg = modelEndpointsSchema.parse({ type: "model-endpoints", models: ["openai/gpt-4o"] });
		expect(cfg.models).toEqual(["openai/gpt-4o"]);
		expect(cfg.limit).toBe(8);
		expect(cfg["unhealthy-only"]).toBe(false);
	});

	it("requires at least one model — the catalogue is 458 slugs wide", () => {
		expect(() => modelEndpointsSchema.parse({ type: "model-endpoints" })).toThrow();
		expect(() => modelEndpointsSchema.parse({ type: "model-endpoints", models: [] })).toThrow();
	});

	it("rejects a model that is not a vendor/model slug", () => {
		expect(() =>
			modelEndpointsSchema.parse({ type: "model-endpoints", models: ["gpt-4o"] }),
		).toThrow();
	});

	it("keeps a quantised-looking slug that carries a prefix", () => {
		const cfg = modelEndpointsSchema.parse({
			type: "model-endpoints",
			models: ["fireworks/ai-fp8-kimi-k3-20260919"],
		});
		expect(cfg.models).toHaveLength(1);
	});

	it("rejects a zero or absurd limit", () => {
		expect(() =>
			modelEndpointsSchema.parse({ type: "model-endpoints", models: ["openai/gpt-4o"], limit: 0 }),
		).toThrow();
		expect(() =>
			modelEndpointsSchema.parse({
				type: "model-endpoints",
				models: ["openai/gpt-4o"],
				limit: 1000,
			}),
		).toThrow();
	});

	it("rejects a provider that is not a bare tag", () => {
		expect(() =>
			modelEndpointsSchema.parse({
				type: "model-endpoints",
				models: ["openai/gpt-4o"],
				provider: "Azure | openai",
			}),
		).toThrow();
	});
});
