import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RexSessionsData } from "../../../shared/widgets/payloads";
import RexSessions from "./index";

const data: RexSessionsData = {
	blocks: [
		{
			blockId: "b2",
			sessionId: "session:aaa",
			sessionLabel: "main",
			windowLabel: "Window two",
			blockLabel: "editor",
			title: "nvim",
			process: "nvim",
			state: "blocked",
			updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
			pwd: "~/proj",
			focused: true,
		},
		{
			blockId: "b1",
			sessionId: "session:aaa",
			sessionLabel: "main",
			windowLabel: "Window one",
			blockLabel: "shell",
			title: "bun › rules",
			process: "bun",
			state: "done",
			updatedAt: null,
			pwd: null,
			focused: false,
		},
	],
};

describe("rex-sessions widget", () => {
	it("shows the default title when the config names none", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={data} />);
		expect(screen.getByText("Rex sessions")).toBeInTheDocument();
	});

	it("renders each block's title with its session/window breadcrumb", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={data} />);
		expect(screen.getByText("nvim")).toBeInTheDocument();
		expect(screen.getByText("bun › rules")).toBeInTheDocument();
		expect(screen.getByText("main · Window two")).toBeInTheDocument();
		expect(screen.getByText("main · Window one")).toBeInTheDocument();
	});

	it("maps states to dots: warning for blocked, success for done", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={data} />);
		expect(screen.getByTestId("rex-dot-blocked")).toBeInTheDocument();
		expect(screen.getByTestId("rex-dot-done")).toBeInTheDocument();
	});

	it("marks the focused block and shows pwd plus a live age", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={data} />);
		expect(screen.getByTestId("rex-focused")).toHaveTextContent("focused");
		expect(screen.getByTestId("rex-pwd")).toHaveTextContent("~/proj");
		expect(screen.getAllByTestId("rex-age")).toHaveLength(1);
	});

	it("falls back to the process name when title is missing", () => {
		const src = data.blocks[1];
		if (!src) throw new Error("fixture missing second block");
		const d: RexSessionsData = {
			blocks: [{ ...src, title: null, blockId: "b9", focused: false }],
		};
		render(<RexSessions config={{ type: "rex-sessions" }} data={d} />);
		expect(screen.getByText("bun")).toBeInTheDocument();
	});

	it("says no sessions rather than rendering an empty card", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={{ blocks: [] }} />);
		expect(screen.getByText("No rex sessions running.")).toBeInTheDocument();
	});

	it("shows the loading skeleton before any payload arrives", () => {
		render(<RexSessions config={{ type: "rex-sessions" }} data={null} />);
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces a fetch failure through the chrome and the header dot", () => {
		render(
			<RexSessions
				config={{ type: "rex-sessions" }}
				data={null}
				error="rex-sessions: rex exited 1"
			/>,
		);
		expect(screen.getByText("rex-sessions: rex exited 1")).toBeInTheDocument();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
	});

	it("stays quiet when show-errors is false, but keeps the header dot", () => {
		render(
			<RexSessions
				config={{ type: "rex-sessions", "show-errors": false }}
				data={null}
				error="rex-sessions: rex exited 1"
			/>,
		);
		expect(screen.queryByText("rex-sessions: rex exited 1")).toBeNull();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
	});
});
