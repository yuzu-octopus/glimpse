import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EventsCalendar from "./index";
import styles from "./events-calendar.module.css";

// Mon 2026-08-24 12:00 local — Today/Tomorrow labels deterministic.
const NOW = new Date(2026, 7, 24, 12, 0, 0);

// Sorted by start, exactly as the server fetcher returns them.
const EVENTS = [
	{
		title: "Standup",
		startISO: new Date(2026, 7, 24, 14).toISOString(),
		endISO: new Date(2026, 7, 24, 14, 30).toISOString(),
		location: "Room 4",
		allDay: false,
	},
	{
		title: "Retro",
		startISO: new Date(2026, 7, 24, 16).toISOString(),
		endISO: new Date(2026, 7, 24, 17).toISOString(),
		allDay: false,
	},
	{
		title: "Deploy review",
		startISO: new Date(2026, 7, 25, 9).toISOString(),
		endISO: new Date(2026, 7, 25, 10).toISOString(),
		allDay: false,
	},
	{ title: "Conference", startISO: new Date(2026, 7, 28).toISOString(), allDay: true },
];

afterEach(() => {
	vi.useRealTimers();
});

describe("events-calendar widget", () => {
	it("groups events under Today/Tomorrow/date headers with time range and location", () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		render(<EventsCalendar config={{ type: "events-calendar" }} data={{ events: EVENTS }} />);
		// Same-day events share one header; later days get Today/Tomorrow/Fri 28.
		const todayGroup = screen.getByRole("region", { name: "Today" });
		expect(todayGroup.textContent).toContain("Standup");
		expect(todayGroup.textContent).toContain("Retro");
		expect(screen.getByRole("region", { name: "Tomorrow" }).textContent).toContain("Deploy review");
		expect(screen.getByRole("region", { name: "Fri 28" }).textContent).toContain("Conference");
		expect(screen.getByText("Room 4")).toBeInTheDocument();
		expect(screen.getByText("All day")).toBeInTheDocument();
	});

	it("renders an empty state with no upcoming events", () => {
		render(<EventsCalendar config={{ type: "events-calendar" }} data={{ events: [] }} />);
		expect(screen.getByText("No upcoming events")).toBeInTheDocument();
	});

	it("places time and title in two grid tracks with the location under the title", () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { container } = render(
			<EventsCalendar config={{ type: "events-calendar" }} data={{ events: EVENTS }} />,
		);
		const event = container.querySelector(`.${styles.event}`) as HTMLElement;

		expect(event.querySelector(`.${styles.time}`)?.textContent).toContain("14:00");
		expect(event.querySelector(`.${styles.title}`)?.textContent).toBe("Standup");
		expect(event.querySelector(`.${styles.location}`)?.textContent).toBe("Room 4");

		const css = readFileSync(
			"src/client/widgets/events-calendar/events-calendar.module.css",
			"utf8",
		);
		expect(css).toMatch(
			/\.event\s*\{[^}]*grid-template-columns:\s*minmax\(84px,\s*auto\)\s+minmax\(0,\s*1fr\)/,
		);
		expect(css).not.toMatch(/padding-left:\s*92px/);
	});
});
