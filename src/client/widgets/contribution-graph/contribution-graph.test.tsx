import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import styles from "./contribution-graph.module.css";
import ContributionGraph from "./index";

const DAYS = [
	{ date: "2024-01-01", count: 0, level: 0 as const },
	{ date: "2024-01-02", count: 3, level: 1 as const },
	{ date: "2024-01-03", count: 8, level: 2 as const },
	{ date: "2024-02-01", count: 15, level: 4 as const },
];

describe("contribution-graph widget", () => {
	it("renders one cell per day with a tooltip", () => {
		render(
			<ContributionGraph
				config={{ type: "contribution-graph", username: "octocat" }}
				data={{ username: "octocat", days: DAYS }}
			/>,
		);
		expect(screen.getByTestId("contribution-grid").children).toHaveLength(DAYS.length);
		expect(screen.getByTitle("3 contributions on 2024-01-02")).toBeInTheDocument();
		expect(screen.getByTitle("0 contributions on 2024-01-01")).toBeInTheDocument();
	});

	it("shows total contributions and colours each cell by its level", () => {
		render(
			<ContributionGraph
				config={{ type: "contribution-graph", username: "octocat" }}
				data={{ username: "octocat", days: DAYS }}
			/>,
		);
		expect(screen.getByText("26 contributions")).toBeInTheDocument();
		// The ramp class is what the user sees. `data-level` copies the payload
		// field verbatim, so asserting it only proves the attribute exists.
		// The class comes through the CSS-module proxy, so this tracks the class
		// and survives a hash change.
		expect(screen.getByTestId("cell-2024-01-03").className).toContain(styles.l2);
		expect(screen.getByTestId("cell-2024-02-01").className).toContain(styles.l4);
		expect(screen.getByTestId("cell-2024-01-01").className).toContain(styles.l0);
	});

	it("renders month labels when a week column starts a new month", () => {
		const weeks = [
			...Array.from({ length: 7 }, (_, i) => ({
				date: `2024-01-${String(8 + i).padStart(2, "0")}`,
				count: 0,
				level: 0 as const,
			})),
			...Array.from({ length: 7 }, (_, i) => ({
				date: `2024-02-0${i + 1}`,
				count: 0,
				level: 0 as const,
			})),
		];
		render(
			<ContributionGraph
				config={{ type: "contribution-graph", username: "octocat" }}
				data={{ username: "octocat", days: weeks }}
			/>,
		);
		expect(screen.getByText("Jan")).toBeInTheDocument();
		expect(screen.getByText("Feb")).toBeInTheDocument();
	});

	it("suppresses a real grid while loading", () => {
		// `data={null}` would make this pass even with the loading branch deleted.
		// Real data is what `isLoading` has to suppress.
		render(
			<ContributionGraph
				config={{ type: "contribution-graph", username: "octocat" }}
				data={{ username: "octocat", days: DAYS }}
				isLoading
			/>,
		);
		expect(screen.queryByTestId("contribution-grid")).toBeNull();
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces fetch errors via chrome", () => {
		render(
			<ContributionGraph
				config={{ type: "contribution-graph", username: "octocat" }}
				data={null}
				error="HTTP 404 for https://github.com/octocat"
			/>,
		);
		expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
		expect(screen.queryByTestId("contribution-grid")).toBeNull();
	});
});
