import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Reddit from "./index";

const posts = [
	{
		title: "First post title",
		url: "https://reddit.com/r/test/comments/1",
		commentsUrl: "https://reddit.com/r/test/comments/1",
		thumbnail: "https://example.com/thumb.jpg",
		flair: "Discussion",
		score: 120,
		comments: 30,
		ageSeconds: 7200,
	},
	{
		title: "Second post",
		url: "https://reddit.com/r/test/comments/2",
		commentsUrl: "https://reddit.com/r/test/comments/2",
		thumbnail: null,
		flair: null,
		score: 5,
		comments: 1,
		ageSeconds: 300,
	},
];

describe("reddit widget", () => {
	it("renders vertical list with title, score, comments and relative age", () => {
		render(
			<Reddit config={{ type: "reddit", title: "Reddit", subreddit: "test" }} data={{ posts }} />,
		);
		expect(screen.getByText("Reddit")).toBeInTheDocument();
		expect(screen.getByText("First post title")).toBeInTheDocument();
		expect(screen.getByText(/120 points/)).toBeInTheDocument();
		expect(screen.getByText(/30 comments/)).toBeInTheDocument();
		expect(screen.getByText(/2h/)).toBeInTheDocument();
		expect(screen.getByText(/5m/)).toBeInTheDocument();
	});

	it("renders thumbnails and flair only when enabled", () => {
		const { container, rerender } = render(
			<Reddit
				config={{ type: "reddit", subreddit: "test", "show-thumbnails": true, "show-flairs": true }}
				data={{ posts }}
			/>,
		);
		expect(container.querySelectorAll("img")).toHaveLength(1);
		expect(screen.getByText("Discussion")).toBeInTheDocument();
		// The "only when" half: with both flags off the same payload must render
		// no pictures and no flair.
		rerender(
			<Reddit
				config={{
					type: "reddit",
					subreddit: "test",
					"show-thumbnails": false,
					"show-flairs": false,
				}}
				data={{ posts }}
			/>,
		);
		expect(container.querySelectorAll("img")).toHaveLength(0);
		expect(screen.queryByText("Discussion")).toBeNull();
	});

	it("renders vertical cards with score meta and horizontal cards as plain cards", () => {
		const { container, rerender } = render(
			<Reddit
				config={{ type: "reddit", subreddit: "test", style: "vertical-cards" }}
				data={{ posts }}
			/>,
		);
		expect(screen.getByText("First post title")).toBeInTheDocument();
		expect(screen.getAllByText(/points/)).toHaveLength(2);
		rerender(
			<Reddit
				config={{ type: "reddit", subreddit: "test", style: "horizontal-cards" }}
				data={{ posts }}
			/>,
		);
		expect(container.querySelectorAll("img")).toHaveLength(1);
		expect(screen.getByText("First post title")).toBeInTheDocument();
		// Plain cards drop the score meta the vertical style carries.
		expect(screen.queryAllByText(/points/)).toHaveLength(0);
	});

	it("shows the empty-state copy rather than a blank card", () => {
		render(<Reddit config={{ type: "reddit", subreddit: "test" }} data={{ posts: [] }} />);
		// `widget-body` is unconditional in WidgetChrome, so the old assertion
		// could only fail on a crash.
		expect(screen.getByText("No posts")).toBeInTheDocument();
	});

	it("renders Reddit as a source header when enabled and no explicit title", () => {
		render(
			<Reddit
				config={{ type: "reddit", subreddit: "test", "source-header": true }}
				data={{ posts }}
			/>,
		);
		expect(screen.getByText("Reddit")).toBeInTheDocument();
	});

	it("ignores source-header when an explicit title is set", () => {
		render(
			<Reddit
				config={{ type: "reddit", subreddit: "test", title: "My Reddit", "source-header": true }}
				data={{ posts }}
			/>,
		);
		expect(screen.getByText("My Reddit")).toBeInTheDocument();
		expect(screen.queryByText("Reddit")).toBeNull();
	});

	it("lets hide-header beat source-header", () => {
		render(
			<Reddit
				config={{ type: "reddit", subreddit: "test", "source-header": true, "hide-header": true }}
				data={{ posts }}
			/>,
		);
		expect(screen.queryByText("Reddit")).toBeNull();
	});
});
