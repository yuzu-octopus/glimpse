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

function dispatchFrom(type: string, y: number, target: EventTarget): Event {
	const e = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
	target.dispatchEvent(e);
	return e;
}

function fixture(axis: "y" | "x" | "none", tag = "div"): HTMLElement {
	const original = window.getComputedStyle;
	const el = document.createElement(tag);
	el.setAttribute("data-ptr-fixture", "");
	el.style.overflowY = axis === "x" ? "visible" : "auto";
	el.style.overflowX = axis === "y" ? "visible" : "auto";
	Object.defineProperty(el, "scrollHeight", { value: axis === "y" ? 500 : 100 });
	Object.defineProperty(el, "clientHeight", { value: 100 });
	Object.defineProperty(el, "scrollWidth", { value: axis === "x" ? 500 : 100 });
	Object.defineProperty(el, "clientWidth", { value: 100 });
	vi.spyOn(window, "getComputedStyle").mockImplementation((node: Element) =>
		node === el ? el.style : original.call(window, node),
	);
	const child = document.createElement("span");
	el.append(child);
	document.body.append(el);
	return child;
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const el of document.body.querySelectorAll("[data-ptr-fixture]")) el.remove();
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

	it("ignores a downward gesture that starts inside an inner scroller", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("y");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("ignores a gesture that starts inside a horizontally scrollable rail", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("x");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("ignores a gesture that starts inside a dialog", () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("none", "dialog");
		dispatchFrom("touchstart", 0, target);
		const move = dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		expect(move.defaultPrevented).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it("still refreshes from the page scrollport", async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);

		dispatch("touchstart", 0);
		dispatch("touchmove", 200);
		dispatch("touchend", 200);

		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
	});

	it("does not suppress PTR for an overflow container with no scrollable extent", async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(
			<PullToRefresh onRefresh={onRefresh}>
				<div>content</div>
			</PullToRefresh>,
		);
		const target = fixture("none");
		dispatchFrom("touchstart", 0, target);
		dispatchFrom("touchmove", 200, target);
		dispatchFrom("touchend", 200, target);

		await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
	});
});
