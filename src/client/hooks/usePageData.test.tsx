import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PagePayload, WidgetPayload } from "../../shared/api";
import type { WidgetType } from "../../shared/config";
import { PageView } from "../pages/PageView";
import { registerWidgetComponent } from "../widgets/registry";
import { __clearCacheForTests, NO_RESPONSE_ERROR, usePageData } from "./usePageData";

function makePayload(overrides: Partial<PagePayload> = {}): PagePayload {
	return {
		name: "Home",
		slug: "home",
		width: "default",
		tiling: "columns",
		headWidgets: [],
		columns: [
			{
				size: "full",
				widgets: [
					{
						type: "clock" as WidgetType,
						config: { type: "clock", title: "Clock" },
						data: { time: "12:00" },
					},
				],
			},
		],
		...overrides,
	};
}

function ndjsonResponse(chunks: unknown[]): Response {
	const body = `${chunks.map((c) => JSON.stringify(c)).join("\n")}\n`;
	return new Response(body, {
		status: 200,
		headers: { "content-type": "application/x-ndjson" },
	});
}

// Mixed lab page fixtures: one live widget, one static widget, and a second
// column whose refs must survive a live merge untouched.
const liveWidget: WidgetPayload = {
	type: "server-stats" as WidgetType,
	config: { type: "server-stats" },
	data: { servers: [] },
};
const staticWidget: WidgetPayload = {
	type: "rss" as WidgetType,
	config: { type: "rss", title: "News" },
	data: { items: [] },
};
const otherWidget: WidgetPayload = {
	type: "clock" as WidgetType,
	config: { type: "clock", title: "Other" },
	data: { time: "12:00" },
};
const mixed = (): PagePayload =>
	makePayload({
		columns: [
			{ size: "full", widgets: [liveWidget, staticWidget] },
			{ size: "full", widgets: [otherWidget] },
		],
		widgets: [],
	});

// Render count of the registered clock stub itself — RenderCounter as a
// sibling of PageView never re-renders when usePageData's setData fires, so
// it cannot measure dedupe. Counting the stub's own renders genuinely
// exercises skip-identical/emit-different.
let clockRenders = 0;

beforeEach(() => {
	clockRenders = 0;
	__clearCacheForTests();
	registerWidgetComponent("clock" as WidgetType, ({ config }) => {
		clockRenders++;
		return <div data-testid="clock-widget">{String(config.title)}</div>;
	});
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	);
});

afterEach(() => {
	__clearCacheForTests();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("usePageData render-skip dedupe", () => {
	it("skips setData when the identical payload is re-emitted, emits when it differs", async () => {
		vi.useFakeTimers();
		let callCount = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				callCount++;
				if (callCount === 1) {
					// First call: skeleton + one widget chunk
					return ndjsonResponse([
						{ path: "$skeleton", payload: makePayload() },
						{
							path: "columns[0].widgets[0]",
							payload: {
								type: "clock",
								config: { type: "clock", title: "Clock" },
								data: { time: "12:00" },
							},
						},
					]);
				}
				// Subsequent calls: identical payload (no change)
				return ndjsonResponse([
					{ path: "$skeleton", payload: makePayload() },
					{
						path: "columns[0].widgets[0]",
						payload: {
							type: "clock",
							config: { type: "clock", title: "Clock" },
							data: { time: "12:00" },
						},
					},
				]);
			}),
		);

		render(
			<MemoryRouter>
				<PageView slug="home" />
			</MemoryRouter>,
		);

		// Switch to real timers: findByTestId uses waitFor (setInterval polling),
		// which never fires under fake timers.
		vi.useRealTimers();
		await screen.findByTestId("clock-widget");
		vi.useFakeTimers();
		const rendersAfterFirstFetch = clockRenders;
		expect(rendersAfterFirstFetch).toBeGreaterThan(0);

		// Advance past STALE_MS so isStale() returns true and focus triggers revalidation
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_001);
		});

		// Trigger a revalidation (focus event)
		await act(async () => {
			window.dispatchEvent(new Event("focus"));
			await vi.advanceTimersByTimeAsync(10);
		});

		// The identical payload should be deduped — no additional renders
		expect(clockRenders).toBe(rendersAfterFirstFetch);

		// Now return a CHANGED payload
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				callCount++;
				return ndjsonResponse([
					{ path: "$skeleton", payload: makePayload() },
					{
						path: "columns[0].widgets[0]",
						payload: {
							type: "clock",
							config: { type: "clock", title: "Clock" },
							data: { time: "13:00" },
						},
					},
				]);
			}),
		);
		// The second poll refreshed the cache timestamp — advance past STALE_MS
		// again so this focus revalidates against the changed payload.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_001);
		});
		await act(async () => {
			window.dispatchEvent(new Event("focus"));
			await vi.advanceTimersByTimeAsync(10);
		});

		// The changed payload should trigger a re-render
		expect(clockRenders).toBeGreaterThan(rendersAfterFirstFetch);
	});

	it("emits when the payload differs even if the version counter resets", async () => {
		vi.useFakeTimers();
		let callCount = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				callCount++;
				if (callCount === 1) {
					return ndjsonResponse([
						{ path: "$skeleton", payload: makePayload() },
						{
							path: "columns[0].widgets[0]",
							payload: {
								type: "clock",
								config: { type: "clock", title: "Clock" },
								data: { time: "12:00" },
							},
						},
					]);
				}
				// Second call: different data
				return ndjsonResponse([
					{ path: "$skeleton", payload: makePayload() },
					{
						path: "columns[0].widgets[0]",
						payload: {
							type: "clock",
							config: { type: "clock", title: "Clock" },
							data: { time: "14:00" },
						},
					},
				]);
			}),
		);

		render(
			<MemoryRouter>
				<PageView slug="home" />
			</MemoryRouter>,
		);

		// Switch to real timers: findByTestId uses waitFor (setInterval polling),
		// which never fires under fake timers.
		vi.useRealTimers();
		await screen.findByTestId("clock-widget");
		vi.useFakeTimers();
		const rendersAfterFirst = clockRenders;

		// Advance past STALE_MS so isStale() returns true and focus triggers revalidation
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_001);
		});

		// Trigger revalidation
		await act(async () => {
			window.dispatchEvent(new Event("focus"));
			await vi.advanceTimersByTimeAsync(10);
		});

		// Changed payload must emit
		expect(clockRenders).toBeGreaterThan(rendersAfterFirst);
	});
});

const seenProbe: PagePayload[] = [];
function SnapshotProbe() {
	const { data } = usePageData("home");
	useEffect(() => {
		if (data) seenProbe.push(data);
	}, [data]);
	return null;
}

describe("usePageData stream reconciliation", () => {
	function gatedNdjson() {
		const enc = new TextEncoder();
		let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
		const stream = new ReadableStream<Uint8Array>({
			start(c) {
				controller = c;
			},
		});
		return {
			response: () =>
				new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson" } }),
			push(line: unknown) {
				controller?.enqueue(enc.encode(`${JSON.stringify(line)}\n`));
			},
			close() {
				controller?.close();
			},
		};
	}
	it("does not mutate a previously emitted column snapshot when a later chunk lands", async () => {
		const skeletonWidget = (title: string) => ({
			type: "clock" as WidgetType,
			config: { type: "clock", title },
			data: null,
		});
		const skeleton = makePayload({
			columns: [{ size: "full", widgets: [skeletonWidget("Clock"), skeletonWidget("Clock 2")] }],
		});
		const chunkA = {
			type: "clock",
			config: { type: "clock", title: "Clock" },
			data: { time: "12:00" },
		};
		const chunkB = {
			type: "clock",
			config: { type: "clock", title: "Clock 2" },
			data: { time: "12:01" },
		};
		const gate = gatedNdjson();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => gate.response()),
		);
		const seen: PagePayload[] = seenProbe;
		seen.length = 0;
		render(<SnapshotProbe />);
		await act(async () => {
			gate.push({ path: "$skeleton", payload: skeleton });
		});
		await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1));
		await act(async () => {
			gate.push({ path: "columns[0].widgets[0]", payload: chunkA });
		});
		await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(2));
		const first = seen[1];
		const firstColumns = first.columns;
		const firstWidgets = first.columns[0].widgets;
		const firstHead = firstWidgets[0];
		expect(firstHead).toEqual(chunkA);
		await act(async () => {
			gate.push({ path: "columns[0].widgets[1]", payload: chunkB });
		});
		await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(3));
		const second = seen[2];
		await act(async () => {
			gate.close();
		});
		// The first emission is a snapshot: the later chunk must not rewrite it.
		expect(first.columns).toBe(firstColumns);
		expect(first.columns[0].widgets).toBe(firstWidgets);
		expect(first.columns[0].widgets[0]).toBe(firstHead);
		expect(first.columns[0].widgets[0]).toEqual(chunkA);
		expect(first.columns[0].widgets[1]).toEqual(skeletonWidget("Clock 2"));
		// The new emission carries both chunks on fresh array refs.
		expect(second.columns).not.toBe(firstColumns);
		expect(second.columns[0].widgets).not.toBe(firstWidgets);
		expect(second.columns[0].widgets[0]).toEqual(chunkA);
		expect(second.columns[0].widgets[1]).toEqual(chunkB);
	});

	it("polls the whole page at 30s and live widgets at 1s", async () => {
		const pageMock = vi.fn(async () =>
			ndjsonResponse([
				{ path: "$skeleton", payload: mixed() },
				{ path: "columns[0].widgets[0]", payload: liveWidget },
				{ path: "columns[0].widgets[1]", payload: staticWidget },
			]),
		);
		const liveMock = vi.fn(async () =>
			ndjsonResponse([
				{
					path: "columns[0].widgets[0]",
					payload: { ...liveWidget, data: { servers: [{ name: "nas" }] } },
				},
			]),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) =>
				String(input).startsWith("/api/live/") ? liveMock() : pageMock(),
			),
		);

		vi.useFakeTimers();
		renderHook(() => usePageData("home"));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(pageMock).toHaveBeenCalledTimes(1);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(5_000);
		});
		expect(pageMock).toHaveBeenCalledTimes(1);
		expect(liveMock.mock.calls.length).toBeGreaterThanOrEqual(4);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(25_000);
		});
		expect(pageMock).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("merges a live frame without replacing untouched region arrays or widget objects", async () => {
		vi.useFakeTimers();
		const pageGate = gatedNdjson();
		const liveMock = vi.fn(async () =>
			ndjsonResponse([
				{
					path: "columns[0].widgets[0]",
					payload: { ...liveWidget, data: { servers: [{ name: "nas" }] } },
				},
			]),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) =>
				String(input).startsWith("/api/live/") ? liveMock() : pageGate.response(),
			),
		);

		seenProbe.length = 0;
		render(<SnapshotProbe />);
		await act(async () => {
			pageGate.push({ path: "$skeleton", payload: mixed() });
			pageGate.close();
			await vi.advanceTimersByTimeAsync(0);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(seenProbe.length).toBeGreaterThan(0);
		const before = seenProbe.at(-1);
		if (!before) throw new Error("first emission missing");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1_000);
		});
		expect(liveMock).toHaveBeenCalled();
		expect(seenProbe.length).toBeGreaterThan(1);
		const after = seenProbe.at(-1);
		if (!after) throw new Error("live emission missing");

		expect(after).not.toBe(before);
		expect(after.headWidgets).toBe(before.headWidgets);
		expect(after.widgets).toBe(before.widgets);
		expect(after.columns[1]).toBe(before.columns[1]);
		expect(after.columns[1].widgets).toBe(before.columns[1].widgets);
		expect(after.columns[0]).not.toBe(before.columns[0]);
		expect(after.columns[0].widgets).not.toBe(before.columns[0].widgets);
		expect(after.columns[0].widgets[1]).toBe(before.columns[0].widgets[1]);
		expect(after.columns[0].widgets[0].data).toEqual({ servers: [{ name: "nas" }] });
		vi.useRealTimers();
	});

	it("keeps a live frame and the no-response stamp across stream end", async () => {
		vi.useFakeTimers();
		const pageGate = gatedNdjson();
		const liveGate = gatedNdjson();
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) =>
				String(input).startsWith("/api/live/") ? liveGate.response() : pageGate.response(),
			),
		);

		const view = renderHook(() => usePageData("home"));
		await act(async () => {
			pageGate.push({
				path: "$skeleton",
				payload: makePayload({
					columns: [
						{
							size: "full",
							widgets: [
								liveWidget,
								{ type: "rss" as WidgetType, config: { type: "rss" }, data: null },
							],
						},
					],
				}),
			});
			pageGate.push({
				path: "columns[0].widgets[0]",
				payload: { ...liveWidget, data: { servers: [] } },
			});
			pageGate.close();
			await vi.advanceTimersByTimeAsync(0);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		const reconciled = view.result.current.data;
		if (!reconciled) throw new Error("reconciled payload missing");
		expect(reconciled.columns[0].widgets[1].error).toBe(NO_RESPONSE_ERROR);

		await act(async () => {
			liveGate.push({
				path: "columns[0].widgets[0]",
				payload: { ...liveWidget, data: { servers: [{ name: "nas" }] } },
			});
			liveGate.close();
			await vi.advanceTimersByTimeAsync(1_000);
		});
		const finalPayload = view.result.current.data;
		if (!finalPayload) throw new Error("final payload missing");
		expect(finalPayload.columns[0].widgets[0].data).toEqual({ servers: [{ name: "nas" }] });
		expect(finalPayload.columns[0].widgets[1].error).toBe(NO_RESPONSE_ERROR);
		vi.useRealTimers();
	});

	it("does not fetch live frames while hidden and revalidates on return", async () => {
		let hidden = true;
		const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
		const stateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
		Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => (hidden ? "hidden" : "visible"),
		});
		const pageMock = vi.fn(async () => ndjsonResponse([{ path: "$skeleton", payload: mixed() }]));
		const liveMock = vi.fn(async () =>
			ndjsonResponse([
				{
					path: "columns[0].widgets[0]",
					payload: liveWidget,
				},
			]),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) =>
				String(input).startsWith("/api/live/") ? liveMock() : pageMock(),
			),
		);

		vi.useFakeTimers();
		renderHook(() => usePageData("home"));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		const pageAfterMount = pageMock.mock.calls.length;
		expect(pageAfterMount).toBe(1);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(31_000);
		});
		expect(pageMock).toHaveBeenCalledTimes(pageAfterMount);
		expect(liveMock).not.toHaveBeenCalled();

		hidden = false;
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
			await vi.advanceTimersByTimeAsync(10);
		});
		expect(pageMock).toHaveBeenCalledTimes(pageAfterMount + 1);
		vi.useRealTimers();
		if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
		if (stateDescriptor) Object.defineProperty(document, "visibilityState", stateDescriptor);
	});

	it("a failing live tick leaves the rendered payload and error untouched", async () => {
		vi.useFakeTimers();
		let liveCalls = 0;
		const liveMock = vi.fn(async () => {
			liveCalls++;
			return new Response(null, { status: 500 });
		});
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) =>
				String(input).startsWith("/api/live/")
					? liveMock()
					: Promise.resolve(ndjsonResponse([{ path: "$skeleton", payload: mixed() }])),
			),
		);

		const view = renderHook(() => usePageData("home"));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		const before = view.result.current.data;
		expect(before).not.toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2_000);
		});
		expect(liveCalls).toBeGreaterThanOrEqual(2);
		expect(view.result.current.data).toBe(before);
		expect(view.result.current.error).toBeNull();
		vi.useRealTimers();
	});
});

describe("usePageData hidden-tab polling", () => {
	it("does not poll a hidden tab and revalidates once on return", async () => {
		let hidden = true;
		const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
		const stateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
		Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => (hidden ? "hidden" : "visible"),
		});
		const payload = makePayload({
			columns: [
				{
					size: "full",
					widgets: [
						{
							type: "server-stats" as WidgetType,
							config: { type: "server-stats" },
							data: { servers: [] },
						},
					],
				},
			],
		});
		const fetchMock = vi.fn(async () => ndjsonResponse([{ path: "$skeleton", payload }]));
		vi.stubGlobal("fetch", fetchMock);

		vi.useFakeTimers();
		const view = renderHook(() => usePageData("home"));
		// The mount fetch stream resolves on microtasks; flush it without
		// uninstalling the fake clock, so the polling interval stays on it.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const afterMount = fetchMock.mock.calls.length;

		await act(async () => {
			// 31s > STALE_MS, so the return path is eligible to revalidate;
			// the homelab interval would otherwise have fired 31 times.
			await vi.advanceTimersByTimeAsync(31_000);
		});
		expect(fetchMock).toHaveBeenCalledTimes(afterMount);

		hidden = false;
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
			await vi.advanceTimersByTimeAsync(10);
		});
		expect(fetchMock).toHaveBeenCalledTimes(afterMount + 1);
		expect(view.result.current.error).toBeNull();

		// The guard sits in the interval only — an explicit reload still fetches.
		hidden = true;
		vi.useRealTimers();
		await act(async () => {
			await view.result.current.reload();
		});
		expect(fetchMock).toHaveBeenCalledTimes(afterMount + 2);

		if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
		if (stateDescriptor) Object.defineProperty(document, "visibilityState", stateDescriptor);
	});
});
