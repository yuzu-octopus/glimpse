import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { GlimpseThemeProvider } from "./client/theme/GlimpseThemeProvider";
import { clientWidgets, registerWidgetComponent } from "./client/widgets/registry";
import type { PagePayload } from "./shared/api";
import type { WidgetType } from "./shared/config";

const CONFIG = {
	pages: [
		{
			name: "Home",
			slug: "home",
			width: "default",
			columns: [
				{
					size: "full",
					widgets: [{ type: "clock", config: { type: "clock", title: "Clock" }, data: null }],
				},
			],
		},
	],
};
type CacheTestHandle = { __clearCacheForTests?: () => void };

function payload(): PagePayload {
	return {
		slug: "home",
		name: "Home",
		width: "default",
		tiling: "columns",
		minColumnWidth: 300,
		headWidgets: [],
		columns: [
			{
				size: "full",
				widgets: [
					{
						type: "clock",
						config: { type: "clock", title: "Clock" },
						data: { time: "12:00" },
						error: undefined,
					},
				],
			},
		],
	};
}

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

/** One page fetch succeeds, then every later one fails the way a dead network
 * does: the payload stays on screen and nothing tells the user it froze. */
function stubApi({ pageFailsAfterFirst = false } = {}) {
	let pageCalls = 0;
	const mock = vi.fn(async (url: string) => {
		if (url === "/api/config") return json({ config: CONFIG });
		if (url === "/api/theme") return json({ customCss: null });
		pageCalls += 1;
		if (pageFailsAfterFirst && pageCalls > 1) throw new TypeError("Failed to fetch");
		return json(payload());
	});
	vi.stubGlobal("fetch", mock);
	return mock;
}

function renderApp() {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<GlimpseThemeProvider>
				<App />
			</GlimpseThemeProvider>
		</MemoryRouter>,
	);
}

beforeEach(async () => {
	const mod: CacheTestHandle = await import("./client/hooks/usePageData");
	mod.__clearCacheForTests?.();
	registerWidgetComponent("clock" as WidgetType, ({ data }) => (
		<div data-testid="clock-widget">{String((data as { time?: string } | null)?.time ?? "")}</div>
	));
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	);
});

afterEach(() => {
	clientWidgets.delete("clock" as WidgetType);
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

/** The clock widget is a LIVE type, so the page polls it every 30s. That poll
 * is what discovers a dead network once a payload is already on screen. */
async function settleFirstLoad() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(50);
	});
}

describe("App shell", () => {
	it("says nothing about freshness while every refresh is landing", async () => {
		stubApi();
		renderApp();

		await waitFor(() => expect(screen.getByText("12:00")).toBeInTheDocument());
		expect(screen.queryByTestId("stale-notice")).toBeNull();
	});

	// A plane. The numbers on screen are a photograph, and nothing said so —
	// which is the one thing a glance dashboard must not do silently.
	it("reports that the page is showing its last known data, without blanking it", async () => {
		vi.useFakeTimers();
		stubApi({ pageFailsAfterFirst: true });
		renderApp();
		await settleFirstLoad();
		expect(screen.getByTestId("clock-widget")).toHaveTextContent("12:00");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});

		expect(screen.getByTestId("stale-notice")).toBeInTheDocument();
		expect(screen.getByText("Showing the last known data")).toBeInTheDocument();
		// The last good reading is still on screen — the notice is additive.
		expect(screen.getByTestId("clock-widget")).toHaveTextContent("12:00");
	});

	it("clears the notice once a refresh lands again", async () => {
		vi.useFakeTimers();
		const mock = stubApi({ pageFailsAfterFirst: true });
		renderApp();
		await settleFirstLoad();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(screen.getByTestId("stale-notice")).toBeInTheDocument();

		mock.mockImplementation(async (url: string) => {
			if (url === "/api/config") return json({ config: CONFIG });
			if (url === "/api/theme") return json({ customCss: null });
			return json(payload());
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});

		expect(screen.queryByTestId("stale-notice")).toBeNull();
	});

	it("names the state as offline when the browser says so", async () => {
		vi.useFakeTimers();
		const original = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
		Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
		try {
			stubApi({ pageFailsAfterFirst: true });
			renderApp();
			await settleFirstLoad();
			await act(async () => {
				await vi.advanceTimersByTimeAsync(30_000);
			});

			expect(screen.getByText("Offline — showing the last known data")).toBeInTheDocument();
		} finally {
			if (original) Object.defineProperty(window.navigator, "onLine", original);
			else delete (window.navigator as unknown as { onLine?: boolean }).onLine;
		}
	});
});
