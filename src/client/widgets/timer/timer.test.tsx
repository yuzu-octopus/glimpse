import { act, fireEvent, render, screen } from "@testing-library/react";
import { CHART_HUES } from "astryx-dracula/shared/chart-hues";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDuration, parseDuration } from "../../../shared/widgets/timer";
import { Timer } from "./index";
import styles from "./timer.module.css";

function renderTimer(config: Record<string, unknown> = {}) {
	return render(
		<Timer
			config={
				{
					type: "timer",
					id: `timer-test-${Math.random().toString(36).slice(2)}`,
					...config,
				} as Record<string, unknown>
			}
			data={null}
		/>,
	);
}

describe("parseDuration", () => {
	it("parses mm:ss", () => expect(parseDuration("25:00")).toBe(1500));
	it("parses hh:mm:ss", () => expect(parseDuration("1:05:30")).toBe(3930));
	it("parses 25m", () => expect(parseDuration("25m")).toBe(1500));
	it("parses 90s", () => expect(parseDuration("90s")).toBe(90));
	it("parses 1h30m", () => expect(parseDuration("1h30m")).toBe(5400));
});

describe("formatDuration", () => {
	it("formats under an hour", () => expect(formatDuration(90)).toBe("1:30"));
	it("formats over an hour", () => expect(formatDuration(3930)).toBe("1:05:30"));
});

describe("timer widget", () => {
	beforeEach(() => localStorage.clear());

	it("renders the default duration and lets the user edit it inline", () => {
		renderTimer({ duration: "25m" });
		const ring = screen.getByTestId("timer-ring");
		fireEvent.click(ring);
		const input = screen.getByLabelText("Duration");
		fireEvent.change(input, { target: { value: "5:00" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(screen.getByTestId("timer-display").textContent).toBe("5:00");
	});

	it("switches between timer and stopwatch tabs", () => {
		renderTimer();
		// Mode is a value, not a view, so SegmentedControl exposes it as a radio
		// group — with the roving arrow-key navigation the old role="tab" pair
		// never had.
		fireEvent.click(screen.getByRole("radio", { name: "Stopwatch" }));
		expect(screen.getByTestId("timer-widget")).toHaveAttribute("data-mode", "stopwatch");
		fireEvent.click(screen.getByRole("radio", { name: "Timer" }));
		expect(screen.getByTestId("timer-widget")).toHaveAttribute("data-mode", "timer");
	});

	it("toggles start/pause and resets", async () => {
		vi.useFakeTimers();
		const { unmount } = renderTimer({ duration: "1:00" });
		act(() => {
			fireEvent.click(screen.getByTestId("timer-toggle"));
		});
		expect(screen.getByTestId("timer-toggle").textContent).toContain("Pause");
		act(() => {
			fireEvent.click(screen.getByTestId("timer-toggle"));
		});
		expect(screen.getByTestId("timer-toggle").textContent).toContain("Start");
		fireEvent.click(screen.getByTestId("timer-reset"));
		expect(screen.getByTestId("timer-display").textContent).toBe("1:00");
		unmount();
		vi.useRealTimers();
	});

	it("shows and persists notes when notes: true", () => {
		renderTimer({ notes: true });
		const textarea = screen.getByTestId("timer-notes");
		fireEvent.change(textarea, { target: { value: "remember to ship" } });
		expect(screen.getByTestId("timer-notes")).toHaveValue("remember to ship");
	});

	it("ring track and arc carry the ring marks", () => {
		const { container } = renderTimer({ duration: "25m" });
		const circles = container.querySelectorAll("svg circle");
		expect(circles).toHaveLength(2);
		expect(circles[0]).toHaveClass(styles.ringTrack);
		expect(circles[1]).toHaveClass(styles.ringValue);
	});

	it("takes the ring ink from the kit CHART_HUES, never purple", () => {
		const { container } = renderTimer({ duration: "25m" });
		const ring = screen.getByTestId("timer-ring");
		// The CSS variable is set inline on the ring button
		expect(ring).toHaveStyle({ "--ring-hue": CHART_HUES.cyan });
		// The SVG circles exist and are styled by the module
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		const circles = svg!.querySelectorAll("circle");
		expect(circles).toHaveLength(2);
		// The ring value circle has a stroke-dasharray (the arc)
		expect(circles[1].getAttribute("stroke-dasharray")).not.toBeNull();
	});

	it("counts down at wall-clock rate, not faster", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		try {
			renderTimer({ duration: "25m" });
			fireEvent.click(screen.getByTestId("timer-toggle"));
			expect(screen.getByTestId("timer-display")).toHaveTextContent("25:00");
			// 250ms of ticks, then 10s of wall clock: a tick that re-charges
			// cumulative elapsed every pass drains ~290s instead of 10s.
			act(() => {
				vi.advanceTimersByTime(10_000);
			});
			expect(screen.getByTestId("timer-display")).toHaveTextContent("24:50");
		} finally {
			vi.useRealTimers();
		}
	});

	it("never renders a loading skeleton — the timer is config-only and has nothing to fetch", () => {
		// PageView derives `isLoading` from `data == null && !error`, and a
		// config-only widget's payload is permanently `data: null`. A renderer
		// that forwards that flag shows a skeleton forever.
		render(
			<Timer
				config={{ type: "timer", id: "timer-loading-probe" } as Record<string, unknown>}
				data={null}
				isLoading
			/>,
		);
		expect(screen.queryByTestId("widget-loading")).toBeNull();
		expect(screen.getByTestId("timer-display")).toHaveTextContent("25:00");
	});

	it("persists timer state to localStorage", () => {
		const id = "timer-persist-test";
		renderTimer({ duration: "10m", id });
		const key = `glimpse.timer.${id}`;
		const stored = localStorage.getItem(key);
		expect(stored).not.toBeNull();
		const parsed = JSON.parse(stored!);
		expect(parsed.seconds).toBe(600);
		expect(parsed.mode).toBe("timer");
		expect(parsed.running).toBe(false);
	});

	it("restores persisted timer state on mount", () => {
		const id = "timer-restore-test";
		const key = `glimpse.timer.${id}`;
		localStorage.setItem(
			key,
			JSON.stringify({ seconds: 600, running: false, mode: "timer", startedAt: null }),
		);
		renderTimer({ duration: "25m", id });
		expect(screen.getByTestId("timer-display")).toHaveTextContent("10:00");
	});

	it("handles invalid duration gracefully", () => {
		renderTimer({ duration: "invalid" });
		// parseDuration('invalid') returns 0, so the timer shows 0:00
		expect(screen.getByTestId("timer-display")).toHaveTextContent("0:00");
	});

	it("handles empty duration gracefully", () => {
		renderTimer({ duration: "" });
		// parseDuration('') returns 0
		expect(screen.getByTestId("timer-display")).toHaveTextContent("0:00");
	});

	it("stopwatch mode counts up", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		try {
			renderTimer({ duration: "25m" });
			fireEvent.click(screen.getByRole("radio", { name: "Stopwatch" }));
			fireEvent.click(screen.getByTestId("timer-toggle"));
			expect(screen.getByTestId("timer-display")).toHaveTextContent("0:00");
			act(() => {
				vi.advanceTimersByTime(5_000);
			});
			expect(screen.getByTestId("timer-display")).toHaveTextContent("0:05");
		} finally {
			vi.useRealTimers();
		}
	});

	it("timer stops at zero", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		try {
			renderTimer({ duration: "1s" });
			fireEvent.click(screen.getByTestId("timer-toggle"));
			expect(screen.getByTestId("timer-display")).toHaveTextContent("0:01");
			act(() => {
				vi.advanceTimersByTime(2_000);
			});
			expect(screen.getByTestId("timer-display")).toHaveTextContent("0:00");
			// Button should say "Start" again (timer stopped)
			expect(screen.getByTestId("timer-toggle").textContent).toContain("Start");
		} finally {
			vi.useRealTimers();
		}
	});

	it("reset returns to configured duration", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		try {
			renderTimer({ duration: "25m" });
			fireEvent.click(screen.getByTestId("timer-toggle"));
			act(() => {
				vi.advanceTimersByTime(10_000);
			});
			expect(screen.getByTestId("timer-display")).not.toHaveTextContent("25:00");
			fireEvent.click(screen.getByTestId("timer-reset"));
			expect(screen.getByTestId("timer-display")).toHaveTextContent("25:00");
		} finally {
			vi.useRealTimers();
		}
	});

	it("handles special characters in notes", () => {
		renderTimer({ notes: true });
		const textarea = screen.getByTestId("timer-notes");
		const special = '<script>alert("xss")</script> & "quotes"';
		fireEvent.change(textarea, { target: { value: special } });
		expect(screen.getByTestId("timer-notes")).toHaveValue(special);
	});
});
