import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Feed from "./feed";
import styles from "./feed.module.css";

describe("Feed (generic)", () => {
	it("renders flat list with title links, meta, description, image and tags", () => {
		const items = [
			{
				title: "First item",
				url: "https://example.com/1",
				meta: "example.com • 12 points • 2h",
				description: "A short description",
				image: "https://example.com/img.jpg",
				tags: ["News", "Tech"],
			},
			{
				title: "Second item",
				url: "https://example.com/2",
				meta: "lobste.rs • 5 points • 10m",
			},
			{
				title: "Third with single tag",
				url: "https://example.com/3",
				tag: "Pinned",
			},
		];

		const { container } = render(<Feed items={items} />);

		// titles as links
		expect(screen.getByText("First item")).toBeInTheDocument();
		expect(screen.getByText("Second item")).toBeInTheDocument();
		expect(screen.getByText("Third with single tag")).toBeInTheDocument();
		expect(screen.getByText("First item").closest("a")).toHaveAttribute(
			"href",
			"https://example.com/1",
		);

		// meta row (subdued)
		expect(screen.getByText("example.com • 12 points • 2h")).toBeInTheDocument();
		expect(screen.getByText("lobste.rs • 5 points • 10m")).toBeInTheDocument();

		// description
		expect(screen.getByText("A short description")).toBeInTheDocument();

		// image
		const img = container.querySelector('img[src="https://example.com/img.jpg"]');
		expect(img).toBeInTheDocument();

		// tags / chips, each wearing the accent hashed from its own text
		expect(screen.getByText("News")).toBeInTheDocument();
		expect(screen.getByText("Tech")).toBeInTheDocument();
		expect(screen.getByText("Pinned")).toBeInTheDocument();

		// rows exist and use the flat list class
		const rows = container.querySelectorAll(`.${styles.item}`);
		expect(rows).toHaveLength(3);

		// meta is supporting-tier metadata, the description is body reading copy
		expect(screen.getByText("example.com • 12 points • 2h")).toHaveAttribute(
			"data-type",
			"supporting",
		);
		expect(screen.getByText("A short description")).toHaveAttribute("data-type", "body");

		// the title clamps through the kit, which also gives it a truncate tooltip
		expect(screen.getByText("First item")).toHaveStyle({ "-webkit-line-clamp": "2" });
	});

	it("clamps titles to one line when the feed asks for single-line titles", () => {
		render(<Feed items={[{ title: "Only title", url: "https://example.com/one" }]} singleLine />);
		expect(screen.getByText("Only title").getAttribute("style") ?? "").not.toContain(
			"-webkit-line-clamp",
		);
	});

	// The old chip cycle assigned colour by DOM position, so the same tag was
	// green on one row and pink on the next. Colour comes from a hash of the tag
	// text now, so it has to survive a change of row — and it must never resolve
	// to a tappable or status hue.
	it("gives the same tag the same Badge variant no matter which row it is in", () => {
		const items = [
			{ title: "a", url: "https://example.com/a", tags: ["Tech"] },
			{ title: "b", url: "https://example.com/b", tags: ["News"] },
			{ title: "c", url: "https://example.com/c", tags: ["Tech"] },
		];
		render(<Feed items={items} />);
		const variantOf = (text: string) =>
			screen.getAllByText(text).map((el) => el.getAttribute("data-variant"));
		const tech = variantOf("Tech");
		expect(tech).toHaveLength(2);
		expect(tech[0]).toBe(tech[1]);
		for (const variant of [...tech, ...variantOf("News")]) {
			expect(variant).not.toBe("purple");
			expect(variant).not.toBe("blue");
		}
	});

	it("renders gracefully with minimal fields (title + url only)", () => {
		const { container } = render(
			<Feed items={[{ title: "Only title", url: "https://example.com/min" }]} />,
		);
		expect(screen.getByText("Only title")).toBeInTheDocument();
		expect(container.querySelectorAll(`.${styles.item}`)).toHaveLength(1);
	});

	// An empty feed used to render `null` inside the widget card, so rss / hn /
	// reddit / lobsters showed a blank bordered box that looked like a broken
	// widget. The empty feed now says so, in the caller's own words.
	it("states the empty case instead of leaving a blank card", () => {
		render(<Feed items={[]} emptyText="No feed items" />);
		expect(screen.getByText("No feed items")).toBeInTheDocument();
	});

	it("falls back to its own wording when the caller supplies none", () => {
		render(<Feed items={[]} />);
		expect(screen.getByText("Nothing to show")).toBeInTheDocument();
	});
});
