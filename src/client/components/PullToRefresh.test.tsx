import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./PullToRefresh";

/** jsdom has no layout, so `atTop` reads scrollY (default 0) and every touch
 *  gesture starts from the top — the only precondition the component checks. */
function dispatch(type: string, y: number, cancelable = true) {
	const e = new Event(type, { bubbles: true, cancelable });
	Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
	window.dispatchEvent(e);
	return e;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PullToRefresh", () => {
	it("does not refresh when the pull is released below the threshold", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 0);
		dispatch("touchmove", 20); // 20 * 0.55 = 11px, well under the 72px threshold
		dispatch("touchend", 20);

		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("refreshes once the pull passes the threshold", async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 0);
		dispatch("touchmove", 200); // 200 * 0.55 = 110px, capped and over threshold
		dispatch("touchend", 200);

		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
	});

	it("ignores an upward drag", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 200);
		dispatch("touchmove", 100); // upward: not the refresh gesture
		dispatch("touchend", 100);

		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("does not re-enter while a refresh is in flight", async () => {
		let resolveRefresh: () => void = () => {};
		const onRefresh = vi.fn(
			() =>
				new Promise<void>((r) => {
					resolveRefresh = r;
				}),
		);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 0);
		dispatch("touchmove", 200);
		dispatch("touchend", 200);
		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));

		// A second pull while the first is unresolved must not fire again.
		dispatch("touchstart", 0);
		dispatch("touchmove", 200);
		dispatch("touchend", 200);
		expect(onRefresh).toHaveBeenCalledTimes(1);

		resolveRefresh();
		await waitFor(() => expect(screen.getByTestId("pull-indicator")).toBeInTheDocument());
	});

	it("renders its children", () => {
		render(
			<PullToRefresh onRefresh={vi.fn().mockResolvedValue(undefined)}>
				<div>page body</div>
			</PullToRefresh>,
		);
		expect(screen.getByText("page body")).toBeInTheDocument();
	});
});
