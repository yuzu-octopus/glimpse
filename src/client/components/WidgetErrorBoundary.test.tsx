import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

/** Throws only while `broken` is set, so a test can prove the boundary
 * recovers when a later payload no longer trips it. */
function Widget({ broken, label }: { broken: boolean; label: string }) {
	if (broken) throw new Error(`Cannot read properties of null (reading 'toLocaleString')`);
	return <div data-testid="widget">{label}</div>;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("WidgetErrorBoundary", () => {
	it("renders its children while nothing throws", () => {
		render(
			<WidgetErrorBoundary identity="a" title="Trending">
				<Widget broken={false} label="repos" />
			</WidgetErrorBoundary>,
		);
		expect(screen.getByTestId("widget")).toHaveTextContent("repos");
	});

	// The whole point: an unvalidated payload that throws while rendering cost
	// every widget on the page before this existed, so a single malformed field
	// blanked the dashboard.
	it("degrades the one widget that throws, not the tree around it", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		render(
			<div>
				<WidgetErrorBoundary identity="a" title="Trending">
					<Widget broken label="boom" />
				</WidgetErrorBoundary>
				<div data-testid="sibling">still here</div>
			</div>,
		);
		expect(screen.queryByTestId("widget")).toBeNull();
		expect(screen.getByText("Trending failed to render")).toBeInTheDocument();
		expect(screen.getByTestId("sibling")).toHaveTextContent("still here");
	});

	// A swallowed render error inside a poll is indistinguishable from a widget
	// with no data, so the crash has to reach the console.
	it("reports the crash and the widget that caused it", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		render(
			<WidgetErrorBoundary identity="a" title="Trending">
				<Widget broken label="boom" />
			</WidgetErrorBoundary>,
		);
		const logged = spy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
		expect(logged).toContain("failed to render");
		expect(logged).toContain("Trending");
		expect(logged).toContain("toLocaleString");
	});

	it("recovers when a new payload arrives for the same widget", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { rerender } = render(
			<WidgetErrorBoundary identity={{ seq: 1 }} title="Trending">
				<Widget broken label="boom" />
			</WidgetErrorBoundary>,
		);
		expect(screen.getByText("Trending failed to render")).toBeInTheDocument();

		rerender(
			<WidgetErrorBoundary identity={{ seq: 2 }} title="Trending">
				<Widget broken={false} label="repos" />
			</WidgetErrorBoundary>,
		);
		expect(screen.getByTestId("widget")).toHaveTextContent("repos");
		expect(screen.queryByText("Trending failed to render")).toBeNull();
	});

	it("stays degraded while the payload that broke it is still the current one", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const identity = { seq: 1 };
		const { rerender } = render(
			<WidgetErrorBoundary identity={identity} title="Trending">
				<Widget broken label="boom" />
			</WidgetErrorBoundary>,
		);
		rerender(
			<WidgetErrorBoundary identity={identity} title="Trending">
				<Widget broken label="boom" />
			</WidgetErrorBoundary>,
		);
		expect(screen.queryByTestId("widget")).toBeNull();
		expect(screen.getByText("Trending failed to render")).toBeInTheDocument();
	});
});
