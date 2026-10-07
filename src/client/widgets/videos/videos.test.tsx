import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Videos from "./index";
import styles from "./videos.module.css";

const videos = [
	{
		title: "Bun 1.3 release",
		url: "https://youtube.com/watch?v=1",
		channel: "Bun",
		published: "2025-01-01T00:00:00Z",
		thumbnail: "https://i.ytimg.com/vi/1/hqdefault.jpg",
	},
	{
		title: "TypeScript 7 deep dive",
		url: "https://youtube.com/watch?v=2",
		channel: "Dev Talk",
		published: "2025-01-02T00:00:00Z",
		thumbnail: null,
	},
];

describe("videos widget", () => {
	it("renders horizontal cards by default", () => {
		render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		expect(screen.getByText("Bun 1.3 release")).toBeInTheDocument();
		expect(screen.getByText("TypeScript 7 deep dive")).toBeInTheDocument();
		expect(screen.getByText("Bun")).toBeInTheDocument();
	});

	it("renders a vertical list with thumbnails", () => {
		render(<Videos config={{ type: "videos", style: "vertical-list" }} data={{ videos }} />);
		expect(screen.getByText("Bun 1.3 release")).toBeInTheDocument();
		expect(screen.getByText(/Dev Talk/)).toBeInTheDocument();
		const img = screen.getByAltText("");
		expect(img).toHaveAttribute("src", "https://i.ytimg.com/vi/1/hqdefault.jpg");
		// glance meta row: relative time next to the channel (combined "596d • Bun")
		expect(screen.getAllByText(/\d+d/).length).toBeGreaterThan(0);
	});

	// The placeholder is the same for every style, so the empty case is
	// parameterised rather than duplicated: `grid-cards` used to get its own
	// test that only proved it did not crash.
	it.each([undefined, "grid-cards"] as const)(
		"videos empty shows placeholder No videos (style %s)",
		(style) => {
			render(
				<Videos
					config={{ type: "videos", channels: ["UCx"], ...(style ? { style } : {}) }}
					data={{ videos: [] }}
				/>,
			);
			expect(screen.getByText(/No videos/)).toBeInTheDocument();
		},
	);

	// YouTube hands out dead hqdefault.jpg paths often enough that 4 of 10
	// thumbnails 404'd, each leaving a bare grey 16:9 box. The failed load must
	// cost the picture, never the card.
	it("falls back to the placeholder when a thumbnail fails to load", () => {
		const { container } = render(
			<Videos config={{ type: "videos", style: "grid-cards" }} data={{ videos }} />,
		);
		const img = container.querySelector<HTMLImageElement>(
			'img[src="https://i.ytimg.com/vi/1/hqdefault.jpg"]',
		);
		expect(img).not.toBeNull();
		fireEvent.error(img!);

		expect(container.querySelector('img[src="https://i.ytimg.com/vi/1/hqdefault.jpg"]')).toBeNull();
		expect(container.querySelector(`.${styles.cardThumbPlaceholder}`)).toBeInTheDocument();
		// the card itself is untouched: title and channel still read
		expect(screen.getByText("Bun 1.3 release")).toBeInTheDocument();
		expect(screen.getByText("Bun")).toBeInTheDocument();
	});

	// A 220px auto-fill track only fits two columns above ~2*220 + gap, so a
	// narrower widget got one track and stretched every card to the full body:
	// eight of them ran 2926px down the Dev page at a 1440px viewport. The
	// threshold has to be the widget's own width, not the viewport's.
	it("goes compact under a narrow widget instead of one huge card per row", () => {
		// jsdom doesn't support container queries, so we pin the DOM structure
		// that the CSS targets: cards are direct children of the grid container,
		// and the grid container carries the class that triggers compact mode.
		const { container } = render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		const grid = container.querySelector('[class*="gridWrap"]');
		expect(grid).toBeInTheDocument();
		// Cards nest inside body wrappers — query the module token within the
		// grid. `_card_<hash>` matches exactly; substring "card" also hits
		// cardThumb/cardTitle/cardMeta sub-elements.
		const cards = Array.from(grid!.querySelectorAll('[class*="_card_"]')).filter((el) =>
			/(?:^|\s)_card_[a-z0-9]+(?:\s|$)/.test((el as HTMLElement).className),
		);
		expect(cards.length).toBe(2);
	});
	// astryx's Link is a styled text link: it nests whatever it renders in one
	// span, which is why the frame used to be re-declared on the anchor. The
	// kit's card container takes a real link of its own instead, so the module
	// keeps only the column stack.
	it("mounts each card as a ClickableCard, not a link wrapping the tile", () => {
		const { container } = render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		const card = container.querySelector<HTMLElement>(`.${styles.card}`)!;
		expect(card.tagName).toBe("DIV");
		// one real link, the card's own, named for the video it opens
		expect(card.querySelectorAll("a")).toHaveLength(1);
		expect(card.contains(screen.getByRole("link", { name: "Bun 1.3 release" }))).toBe(true);
	});

	it("leaves the card frame to the kit: no inline background, border or radius", () => {
		const { container } = render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		const card = container.querySelector<HTMLElement>(`.${styles.card}`)!;
		// The card element itself carries no inline frame styles — the kit's
		// ClickableCard owns the visual frame.
		expect(card.style.background).toBe("");
		expect(card.style.border).toBe("");
		expect(card.style.borderRadius).toBe("");
	});

	it("surfaces a fetch error via the widget chrome", () => {
		render(
			<Videos config={{ type: "videos", title: "Videos" }} data={null} error="HTTP 403 for feed" />,
		);
		expect(screen.getByText("HTTP 403 for feed")).toBeInTheDocument();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
		expect(screen.queryByText("Bun 1.3 release")).toBeNull();
	});

	// A dead source among live ones is a status, not a widget failure: the
	// videos that did arrive still render, and the source wears a StatusDot
	// rather than a red Banner over content the user can still read.
	it("flags a dead source with a StatusDot and keeps the live videos", () => {
		render(
			<Videos
				config={{ type: "videos" }}
				data={{ videos, issues: [{ source: "@Fireship", reason: "HTTP 404" }] }}
			/>,
		);
		expect(screen.getByText("Bun 1.3 release")).toBeInTheDocument();
		const dot = screen.getByTestId("videos-source-dot");
		// The kit's own StatusDot, not a hand-rolled span. Asserted through the
		// hooks it actually exposes — accessible name and data-variant. The
		// `astryx-statusdot` class is core's legacyNames shim and 0.7.0 drops it.
		expect(dot).toHaveAttribute("data-variant", "error");
		expect(dot).toHaveAccessibleName("@Fireship: HTTP 404");
		expect(screen.getByText("@Fireship")).toBeInTheDocument();
		expect(screen.getByText("HTTP 404")).toBeInTheDocument();
		expect(screen.queryByTestId("widget-error-dot")).toBeNull();
	});

	it("a healthy payload adds no chrome at all", () => {
		const { container } = render(
			<Videos config={{ type: "videos" }} data={{ videos, issues: [] }} />,
		);
		expect(screen.queryByTestId("videos-issues")).toBeNull();
		expect(container.querySelector(".notice")).toBeNull();
	});

	it("every dead source gets its own dot, including next to the placeholder", () => {
		render(
			<Videos
				config={{ type: "videos" }}
				data={{
					videos: [],
					issues: [
						{ source: "@Fireship", reason: "HTTP 404" },
						{ source: "UCdead", reason: "no videos found" },
					],
				}}
			/>,
		);
		expect(screen.getByTestId("videos-issues")).toBeInTheDocument();
		expect(screen.getAllByTestId("videos-source-dot")).toHaveLength(2);
		expect(screen.getByText(/No videos/)).toBeInTheDocument();
	});

	it("grid-cards and vertical-list render distinct containers", () => {
		// grid-cards mounts the card grid; vertical-list delegates rows to the
		// shared Feed (no .cards container of its own).
		const grid = render(
			<Videos config={{ type: "videos", style: "grid-cards" }} data={{ videos }} />,
		);
		expect(grid.container.querySelector('[class*="gridWrap"]')).toBeInTheDocument();
		grid.unmount();
		const list = render(
			<Videos config={{ type: "videos", style: "vertical-list" }} data={{ videos }} />,
		);
		expect(list.container.querySelector('[class*="gridWrap"]')).toBeNull();
		expect(list.container.querySelector('[class*="cards"]')).toBeNull();
	});

	it("renders relative age for each video", () => {
		render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		// Both videos have published dates — age should appear
		expect(screen.getAllByText(/\d+d/).length).toBeGreaterThan(0);
	});

	it("handles null thumbnail gracefully", () => {
		const { container } = render(<Videos config={{ type: "videos" }} data={{ videos }} />);
		// Second video has thumbnail: null — should show placeholder, not broken img
		const grid = container.querySelector('[class*="gridWrap"]');
		const cards = Array.from(grid!.querySelectorAll('[class*="_card_"]')).filter((el) =>
			/(?:^|\s)_card_[a-z0-9]+(?:\s|$)/.test((el as HTMLElement).className),
		);
		const placeholder = cards[1].querySelector('[class*="cardThumbPlaceholder"]');
		expect(placeholder).toBeInTheDocument();
		expect(cards[1].querySelector("img")).toBeNull();
	});

	it("handles special characters in title and channel", () => {
		const specialVideos = [
			{
				title: 'Test <script> & "quotes"',
				url: "https://youtube.com/watch?v=special",
				channel: "Dev & Co",
				published: "2025-01-01T00:00:00Z",
				thumbnail: null,
			},
		];
		render(<Videos config={{ type: "videos" }} data={{ videos: specialVideos }} />);
		expect(screen.getByText('Test <script> & "quotes"')).toBeInTheDocument();
		expect(screen.getByText("Dev & Co")).toBeInTheDocument();
	});

	it("collapses grid-cards by rows", () => {
		const manyVideos = Array.from({ length: 6 }, (_, i) => ({
			title: `Video ${i}`,
			url: `https://youtube.com/watch?v=${i}`,
			channel: "Test",
			published: "2025-01-01T00:00:00Z",
			thumbnail: null,
		}));
		render(
			<Videos
				config={{ type: "videos", style: "grid-cards", "collapse-after-rows": 1 }}
				data={{ videos: manyVideos }}
			/>,
		);
		// With 6 videos and collapse-after-rows: 1, only the first row shows
		// The exact count depends on the grid, but "Show more" should appear
		expect(screen.getByText(/Show more/)).toBeInTheDocument();
	});
});
