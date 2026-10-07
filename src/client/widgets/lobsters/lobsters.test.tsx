import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Lobsters from "./index";

const posts = [
	{
		id: 1,
		title: "First post",
		url: "https://lobste.rs/s/1",
		commentsUrl: "https://lobste.rs/s/1/comments",
		score: 42,
		comments: 7,
		ageSeconds: 3600,
		tags: ["programming"],
	},
	{
		id: 2,
		title: "Second post",
		url: "https://lobste.rs/s/2",
		commentsUrl: "https://lobste.rs/s/2/comments",
		score: 3,
		comments: 0,
		ageSeconds: 120,
		tags: ["hardware"],
	},
];

describe("lobsters widget", () => {
	it("renders posts with score, comments and relative age", () => {
		render(
			<Lobsters
				config={{ type: "lobsters", title: "Lobsters", "collapse-after": 5 }}
				data={{ posts }}
			/>,
		);
		expect(screen.getByText("Lobsters")).toBeInTheDocument();
		expect(screen.getByText("First post")).toBeInTheDocument();
		expect(screen.getByText("Second post")).toBeInTheDocument();
		expect(screen.getByText(/42 points/)).toBeInTheDocument();
		expect(screen.getByText(/7 comments/)).toBeInTheDocument();
		expect(screen.getByText(/1h/)).toBeInTheDocument();
	});

	it("shows the empty-state copy rather than a blank card", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={{ posts: [] }} />);
		// `widget-body` is unconditional in WidgetChrome, so the old assertion
		// could only fail on a crash.
		expect(screen.getByText("No posts")).toBeInTheDocument();
	});

	it('collapses posts beyond collapse-after until "Show more" is clicked', () => {
		render(<Lobsters config={{ type: "lobsters", "collapse-after": 1 }} data={{ posts }} />);
		expect(screen.getByText("First post")).toBeInTheDocument();
		expect(screen.queryByText("Second post")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /show more/i }));
		expect(screen.getByText("Second post")).toBeInTheDocument();
	});

	it("renders Lobsters as a source header when enabled and no explicit title", () => {
		render(<Lobsters config={{ type: "lobsters", "source-header": true }} data={{ posts }} />);
		expect(screen.getByText("Lobsters")).toBeInTheDocument();
	});

	it("ignores source-header when an explicit title is set", () => {
		render(
			<Lobsters
				config={{ type: "lobsters", title: "My Lobsters", "source-header": true }}
				data={{ posts }}
			/>,
		);
		expect(screen.getByText("My Lobsters")).toBeInTheDocument();
		expect(screen.queryByText("Lobsters")).toBeNull();
	});

	it("lets hide-header beat source-header", () => {
		render(
			<Lobsters
				config={{ type: "lobsters", "source-header": true, "hide-header": true }}
				data={{ posts }}
			/>,
		);
		expect(screen.queryByText("Lobsters")).toBeNull();
	});

	it("extracts domain from URL for meta", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={{ posts }} />);
		// Both posts link lobste.rs, so both meta lines match — assert each row.
		const metas = screen.getAllByText(/lobste\.rs/);
		expect(metas).toHaveLength(2);
		expect(metas[0]).toHaveTextContent("lobste.rs • 42 points • 7 comments");
		expect(metas[1]).toHaveTextContent("lobste.rs • 3 points • 0 comments");
	});

	it("renders tags as badges", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={{ posts }} />);
		expect(screen.getByText("programming")).toBeInTheDocument();
		expect(screen.getByText("hardware")).toBeInTheDocument();
	});

	it("links to comments URL", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={{ posts }} />);
		expect(screen.getByRole("link", { name: /First post/ })).toHaveAttribute(
			"href",
			"https://lobste.rs/s/1",
		);
	});

	it('toggles to "Show less" when expanded', () => {
		render(<Lobsters config={{ type: "lobsters", "collapse-after": 1 }} data={{ posts }} />);
		fireEvent.click(screen.getByRole("button", { name: /show more/i }));
		expect(screen.getByText("Second post")).toBeInTheDocument();
		expect(screen.getByText("Show less")).toBeInTheDocument();
	});

	it("shows loading skeleton while data is null", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={null} />);
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces fetch errors via chrome", () => {
		render(<Lobsters config={{ type: "lobsters" }} data={null} error="lobsters: network error" />);
		// No title here, so the chrome renders the error Banner without the
		// header StatusDot — the Banner is the whole error surface.
		const banner = screen.getByRole("alert");
		expect(banner).toHaveTextContent("lobsters: network error");
	});
});
