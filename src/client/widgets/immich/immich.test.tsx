import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MediaData } from "../../../shared/widgets/payloads";
import Immich from "./index";

const data: MediaData = {
	items: [
		{
			title: "IMG_001.jpg",
			subtitle: null,
			poster: "https://immich.lab/api/assets/a1/thumbnail",
			url: "https://immich.lab/photos/a1",
			date: "2024-05-01T10:00:00",
		},
		{ title: "IMG_002.jpg", subtitle: null, poster: null, url: null, date: null },
	],
};

describe("immich widget", () => {
	it("renders poster cards with titles", () => {
		const { container } = render(<Immich config={{ type: "immich" }} data={data} />);
		expect(screen.getByText("Immich")).toBeInTheDocument();
		expect(screen.getByText("IMG_001.jpg")).toBeInTheDocument();
		expect(screen.getAllByTestId("media-card")).toHaveLength(2);
		// decorative poster (alt="") is presentational — query the DOM directly
		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"https://immich.lab/api/assets/a1/thumbnail",
		);
	});

	it("links cards to the photo page", () => {
		render(<Immich config={{ type: "immich" }} data={data} />);
		expect(screen.getByRole("link", { name: /IMG_001/ })).toHaveAttribute(
			"href",
			"https://immich.lab/photos/a1",
		);
	});

	it("shows a placeholder when empty", () => {
		render(<Immich config={{ type: "immich" }} data={{ items: [] }} />);
		expect(screen.getByText(/No recent photos/)).toBeInTheDocument();
	});

	it("shows loading skeleton while data is null", () => {
		render(<Immich config={{ type: "immich" }} data={null} />);
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces fetch errors via chrome", () => {
		render(<Immich config={{ type: "immich" }} data={null} error="immich: missing api-key" />);
		expect(screen.getByText("immich: missing api-key")).toBeInTheDocument();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
	});

	it("renders a placeholder div when poster is null", () => {
		render(<Immich config={{ type: "immich" }} data={data} />);
		const cards = screen.getAllByTestId("media-card");
		// Second card has poster: null
		const placeholder = cards[1].querySelector('[class*="posterPlaceholder"]');
		expect(placeholder).toBeInTheDocument();
		expect(cards[1].querySelector("img")).toBeNull();
	});

	it("renders a non-link card when url is null", () => {
		render(<Immich config={{ type: "immich" }} data={data} />);
		const cards = screen.getAllByTestId("media-card");
		// Second card has url: null — ClickableCard with href=undefined renders as div
		expect(cards[1].tagName).toBe("DIV");
		expect(cards[1].querySelector("a")).toBeNull();
	});

	it("renders meta line with subtitle and date", () => {
		render(<Immich config={{ type: "immich" }} data={data} />);
		// First card has subtitle: null, date: '2024-05-01T10:00:00'
		// ageOf returns 'today' or 'Xd ago' depending on current date
		const cards = screen.getAllByTestId("media-card");
		const meta = cards[0].querySelector('[class*="meta"]');
		expect(meta).toBeInTheDocument();
		expect(meta!.textContent).toMatch(/\d+d ago|today|yesterday/);
	});

	it("renders no meta line when both subtitle and date are null", () => {
		render(<Immich config={{ type: "immich" }} data={data} />);
		const cards = screen.getAllByTestId("media-card");
		// Second card has subtitle: null, date: null
		const meta = cards[1].querySelector('[class*="meta"]');
		expect(meta).toBeNull();
	});

	it("handles long titles without crashing", () => {
		const longTitle = "A".repeat(500);
		render(
			<Immich
				config={{ type: "immich" }}
				data={{
					items: [{ title: longTitle, subtitle: null, poster: null, url: null, date: null }],
				}}
			/>,
		);
		expect(screen.getByText(longTitle)).toBeInTheDocument();
	});
});
