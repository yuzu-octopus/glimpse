import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrendingData } from "../../../shared/widgets/payloads";
import Trending from "./index";

const REPOS: TrendingData = [
	{
		fullName: "acme/widget",
		description: "A widget",
		language: "TypeScript",
		stars: 1234,
		starsToday: 56,
		url: "https://github.com/acme/widget",
	},
];

describe("github-trending widget", () => {
	it("renders the repo, its language and its star count", () => {
		render(<Trending config={{ type: "github-trending" }} data={REPOS} />);
		expect(screen.getByText("acme/widget")).toBeInTheDocument();
		expect(screen.getByText("TypeScript")).toBeInTheDocument();
		expect(screen.getByText("1,234 ★")).toBeInTheDocument();
		expect(screen.getByText("+56 today")).toBeInTheDocument();
	});

	// `stars` is scraped out of GitHub's HTML, not validated, and
	// `r.stars.toLocaleString()` was the one numeric access in the file with no
	// guard. A null there threw during render, and with no boundary anywhere in
	// src/ that unmounted every widget on the page.
	it("drops the star count rather than throwing when it is not a number", () => {
		const { container } = render(
			<Trending
				config={{ type: "github-trending" }}
				data={[{ ...REPOS[0]!, stars: null as unknown as number }]}
			/>,
		);
		expect(screen.getByText("acme/widget")).toBeInTheDocument();
		expect(container.textContent).not.toContain("★");
	});

	it("drops the star count when the scrape produced NaN", () => {
		const { container } = render(
			<Trending
				config={{ type: "github-trending" }}
				data={[{ ...REPOS[0]!, stars: Number.NaN }]}
			/>,
		);
		expect(screen.getByText("acme/widget")).toBeInTheDocument();
		expect(container.textContent).not.toContain("★");
	});

	it("shows the empty state when there are no repos", () => {
		render(<Trending config={{ type: "github-trending" }} data={[]} isLoading={false} />);
		expect(screen.getByText("No trending repos")).toBeInTheDocument();
	});
});
