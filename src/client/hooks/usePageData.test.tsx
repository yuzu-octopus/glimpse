import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PagePayload } from "../../shared/api";
import type { WidgetType } from "../../shared/config";
import { PageView } from "../pages/PageView";
import { registerWidgetComponent } from "../widgets/registry";
import { __clearCacheForTests, usePageData } from "./usePageData";

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
});
