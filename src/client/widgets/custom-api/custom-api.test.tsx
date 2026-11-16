import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CustomApi from "./index";

const items = [
	{
		title: "Deploy #42",
		url: "https://ci.example.com/42",
		description: "release-candidate",
		icon: "https://example.com/icon.png",
		subtitle: "main",
		value: "success",
		image: null,
		timestamp: "2m ago",
	},
	{
		title: "No extras",
		url: null,
		description: null,
		icon: null,
		subtitle: null,
		value: null,
		image: null,
		timestamp: null,
	},
];

describe("custom-api widget", () => {
	it("renders list rows with value and timestamp", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", title: "CI", url: "https://api.example.com" }}
				data={{ items, frameless: false }}
			/>,
		);
		expect(screen.getByText("CI")).toBeInTheDocument();
		expect(screen.getByText("Deploy #42")).toBeInTheDocument();
		expect(screen.getByText("main")).toBeInTheDocument();
		expect(screen.getByText("success")).toBeInTheDocument();
		expect(screen.getByText("2m ago")).toBeInTheDocument();
		expect(screen.getByText("No extras")).toBeInTheDocument();
	});

	// A value the reader acts on is body copy; its timestamp and the subtitle
	// are metadata. A title with a url is a real link, one without is not.
	it("assigns each string its text tier and links only the url-backed title", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", title: "CI", url: "https://api.example.com" }}
				data={{ items, frameless: false }}
			/>,
		);
		expect(screen.getByText("success")).toHaveAttribute("data-type", "body");
		expect(screen.getByText("main")).toHaveAttribute("data-type", "supporting");
		expect(screen.getByText("2m ago")).toHaveAttribute("data-type", "supporting");
		expect(screen.getByText("Deploy #42").closest("a")).toHaveAttribute(
			"href",
			"https://ci.example.com/42",
		);
		expect(screen.getByText("No extras").closest("a")).toBeNull();
	});

	it("renders without chrome when frameless", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", frameless: true, url: "https://api.example.com" }}
				data={{ items, frameless: true }}
			/>,
		);
		expect(screen.getByText("Deploy #42")).toBeInTheDocument();
		expect(screen.getByTestId("custom-api-frameless")).toBeInTheDocument();
		expect(screen.queryByTestId("widget-body")).toBeNull();
	});

	it("shows the loading skeleton while the payload is still null", () => {
		// `items: []` renders no user-visible output at all, so the old version
		// could only fail on a crash. The state a user actually sees with no data
		// yet is the loading one — and it must be distinguishable from empty.
		render(
			<CustomApi config={{ type: "custom-api", url: "https://api.example.com" }} data={null} />,
		);
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
		expect(screen.queryByText("Deploy #42")).toBeNull();
	});

	it("surfaces a fetch error via the widget chrome", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", title: "CI", url: "https://api.example.com" }}
				data={{ items: [], frameless: false }}
				error="HTTP 500 for https://api.example.com"
			/>,
		);
		expect(screen.getByText("HTTP 500 for https://api.example.com")).toBeInTheDocument();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
	});

	it("shows the error inline when frameless", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", frameless: true, url: "https://api.example.com" }}
				data={{ items: [], frameless: true }}
				error="upstream down"
			/>,
		);
		expect(screen.getByTestId("custom-api-frameless")).toBeInTheDocument();
		expect(screen.getByText("upstream down")).toBeInTheDocument();
	});

	it("stargazers shows star icon", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", url: "https://api.github.com/repos/a/b" }}
				data={{ items: [{ title: "Stargazers", value: "36462" }], frameless: false }}
			/>,
		);
		expect(screen.getByTestId("custom-api-star")).toBeInTheDocument();
	});
	it("non-star title does not show star icon", () => {
		render(
			<CustomApi
				config={{ type: "custom-api", url: "https://api.github.com/repos/a/b" }}
				data={{ items: [{ title: "Forks", value: "100" }], frameless: false }}
			/>,
		);
		expect(screen.queryByTestId("custom-api-star")).not.toBeInTheDocument();
	});

	it("shrinks a long value and timestamp to one line without disabling the tooltip", () => {
		const longValue = "a".repeat(240);
		render(
			<CustomApi
				config={{ type: "custom-api", title: "CI" }}
				data={{
					items: [{ ...items[0], value: longValue, image: null, icon: null }],
					frameless: false,
				}}
			/>,
		);

		// Core 0.7.16 clamps maxLines={1} with class-based nowrap/ellipsis rather
		// than an inline -webkit-line-clamp, and StyleX classes resolve to no
		// computed style in jsdom. The title and subtitle already clamp at one
		// line, so their shared StyleX classes are exactly the clamp markers;
		// the trailing value and timestamp must carry every one of them.
		const clampClasses = [...screen.getByText("main").classList].filter((cls) =>
			screen.getByText("Deploy #42").classList.contains(cls),
		);
		expect(clampClasses.length).toBeGreaterThan(0);
		for (const el of [screen.getByText(longValue), screen.getByText("2m ago")]) {
			for (const cls of clampClasses) {
				expect(el.classList.contains(cls)).toBe(true);
			}
		}
		expect(screen.getByText("Deploy #42")).toBeInTheDocument();

		const css = readFileSync("src/client/widgets/custom-api/custom-api.module.css", "utf8");
		expect(css).toMatch(/\.rowRight\s*\{[^}]*min-width:\s*0/);
		expect(css).not.toMatch(/\.rowRight\s*\{[^}]*flex-shrink:\s*0/);
		const jsx = readFileSync("src/client/widgets/custom-api/index.tsx", "utf8");
		expect(jsx).not.toMatch(/hasTruncateTooltip=\{false\}/);
		expect(css).toMatch(/\.icon\s*\{[^}]*flex-shrink:\s*0/);
		expect(css).toMatch(/\.image\s*\{[^}]*flex-shrink:\s*0/);
	});
});
