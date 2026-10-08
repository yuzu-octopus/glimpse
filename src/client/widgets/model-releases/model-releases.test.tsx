import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ModelReleases from "./index";

const SAMPLE_ITEMS = [
	{
		id: "1",
		model: "Llama 4 Scout",
		author: "Meta",
		description: "Open multimodal foundation model.",
		url: "https://meta.ai/llama-4",
		publishedAt: "2026-10-08T00:00:00Z",
		topicLabel: "Models",
		tags: ["models", "open-source"],
	},
	{
		id: "2",
		model: "o3-mini",
		author: "OpenAI",
		description: "Cost-efficient reasoning model.",
		url: "https://openai.com/o3",
		publishedAt: "2026-10-07T00:00:00Z",
		topicLabel: "Models",
		tags: ["models"],
	},
];

describe("ModelReleases component", () => {
	it("renders models, author badges, and descriptions in vertical-list mode", () => {
		render(
			<ModelReleases
				config={{ type: "model-releases", style: "vertical-list" }}
				data={{ items: SAMPLE_ITEMS }}
			/>,
		);

		expect(screen.getByRole("link", { name: "Llama 4 Scout" })).toHaveAttribute(
			"href",
			"https://meta.ai/llama-4",
		);
		expect(screen.getByText("Meta")).toBeInTheDocument();
		expect(screen.getByText("Open multimodal foundation model.")).toBeInTheDocument();

		expect(screen.getByRole("link", { name: "o3-mini" })).toHaveAttribute(
			"href",
			"https://openai.com/o3",
		);
		expect(screen.getByText("OpenAI")).toBeInTheDocument();
		expect(screen.getByText("Cost-efficient reasoning model.")).toBeInTheDocument();
	});

	it("renders compact mode omitting descriptions", () => {
		render(
			<ModelReleases
				config={{ type: "model-releases", style: "compact" }}
				data={{ items: SAMPLE_ITEMS }}
			/>,
		);

		expect(screen.getByRole("link", { name: "Llama 4 Scout" })).toBeInTheDocument();
		expect(screen.queryByText("Open multimodal foundation model.")).toBeNull();
	});

	it("renders empty state when items list is empty", () => {
		render(<ModelReleases config={{ type: "model-releases" }} data={{ items: [] }} />);

		expect(screen.getByText("No recent model releases")).toBeInTheDocument();
	});
});
