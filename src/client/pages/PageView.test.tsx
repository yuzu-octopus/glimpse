import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { PagePayload, WidgetPayload } from "../../shared/api";
import type { Page, WidgetType } from "../../shared/config";
import { GlimpseThemeProvider } from "../theme/GlimpseThemeProvider";
import { clientWidgets, registerWidgetComponent } from "../widgets/registry";
import { PageSkeleton, PageView } from "./PageView";

function payload(overrides: Partial<PagePayload> = {}): PagePayload {
	return {
		slug: "home",
		name: "Home",
		width: "default",
		headWidgets: [],
		columns: [
			{
				size: "full",
				widgets: [
					{
						type: "clock",
						config: { type: "clock", title: "Clock", timezones: [] },
						data: null,
					},
				],
			},
		],
		...overrides,
	};
}

beforeEach(async () => {
	try {
		const mod = await import("../hooks/usePageData");
		(mod as any).__clearCacheForTests?.();
	} catch {}
	registerWidgetComponent("clock" as WidgetType, ({ config, error }) => (
		<div data-testid="clock-widget">
			{error ? <span data-testid="widget-error">{error}</span> : String(config.title)}
		</div>
	));
	// jsdom lacks matchMedia; Astryx components (Spinner, Theme) use it
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

function renderPage(p: PagePayload) {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(p), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
	return render(
		<MemoryRouter>
			<PageView slug={p.slug} />
		</MemoryRouter>,
	);
}

// Shared by the App-level tests: one config, two pages, so the module-level
// useConfig cache stays consistent across both renders.
const APP_CONFIG_PAGES = [
	{
		name: "Home",
		slug: "home",
		width: "default",
		"hide-desktop-navigation": true,
		"desktop-navigation-width": "slim",
		columns: [
			{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
		],
	},
	{
		name: "Docs",
		slug: "docs",
		width: "default",
		columns: [
			{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
		],
	},
];

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

function renderApp(initialEntry: string) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			if (url === "/api/config") return json({ config: { pages: APP_CONFIG_PAGES } });
			if (url === "/api/theme") return json({ customCss: null });
			return json(payload());
		}),
	);
	return render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<GlimpseThemeProvider>
				<App />
			</GlimpseThemeProvider>
		</MemoryRouter>,
	);
}

describe("PageView", () => {
	it("renders widget components from the registry", async () => {
		renderPage(payload());
		const widget = await screen.findByTestId("clock-widget");
		expect(within(widget).getByText("Clock")).toBeInTheDocument();
	});

	it("renders per-widget skeleton cards from the page config while loading, then fills", async () => {
		vi.useFakeTimers();
		const { promise: fetchPromise, resolve: resolveFetch } = Promise.withResolvers<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => fetchPromise),
		);
		const page: Page & { slug: string } = {
			slug: "home",
			name: "Home",
			tiling: "auto",
			columns: [
				{
					size: "full",
					span: 2,
					widgets: [
						{ type: "clock", title: "Clock", timezones: [], retries: 3, "show-errors": true },
						{
							type: "clock",
							title: "Second Clock",
							timezones: [],
							retries: 3,
							"show-errors": true,
						},
					],
				},
			],
		};
		render(
			<MemoryRouter>
				<PageView slug="home" page={page} />
			</MemoryRouter>,
		);
		// Before delay: no skeleton (flash suppression)
		expect(screen.queryByTestId("page-skeleton")).toBeNull();
		act(() => {
			vi.advanceTimersByTime(260);
		});
		// Loading: the config structure renders one skeleton card per widget.
		expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
		expect(screen.getAllByTestId("widget-loading")).toHaveLength(2);
		// The skeleton mirrors the ready auto-tiling layout: same grid class,
		// min-column-width var (default 300), and per-column span hint.
		const skeletonGrid = screen
			.getByTestId("page-skeleton")
			.querySelector('[class*="columns"]') as HTMLElement;
		expect(skeletonGrid.className).toContain("autoTiling");
		expect(skeletonGrid.style.getPropertyValue("--min-column-width")).toBe("300px");
		expect(
			Array.from(skeletonGrid.querySelectorAll("[data-span]")).map((t) =>
				t.getAttribute("data-span"),
			),
		).toEqual(["2"]);
		// Switch to real timers for async fill (afterEach is safety net on failure)
		vi.useRealTimers();
		await act(async () => {
			resolveFetch(
				new Response(JSON.stringify(payload()), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
		});
		const widget = await screen.findByTestId("clock-widget");
		expect(within(widget).getByText("Clock")).toBeInTheDocument();
		await waitFor(() => expect(screen.queryByTestId("widget-loading")).toBeNull());
	});

	it("never marks a config-only widget loading, but still waits for a data widget", async () => {
		// A config-only widget's payload is `data: null` by design and no chunk
		// will ever arrive, so deriving `isLoading` from the payload alone
		// strands its skeleton permanently. A data widget must keep showing
		// one until its data lands — the flag is not a blanket "null data".
		const seen: { type: string; isLoading: unknown }[] = [];
		const probe = (type: string) => {
			const C = (props: { isLoading?: boolean }) => {
				seen.push({ type, isLoading: props.isLoading });
				return <div data-testid={`probe-${type}`} />;
			};
			registerWidgetComponent(type as WidgetType, C);
			return C;
		};
		probe("clock");
		probe("weather");
		try {
			renderPage(
				payload({
					columns: [
						{
							size: "full",
							widgets: [
								{ type: "clock" as WidgetType, config: { type: "clock" }, data: null },
								{
									type: "weather" as WidgetType,
									config: { type: "weather", location: "London" },
									data: null,
								},
							],
						},
					],
				}),
			);
			await screen.findByTestId("probe-clock");
			await screen.findByTestId("probe-weather");
			const byType = new Map(seen.map((s) => [s.type, s.isLoading]));
			expect(byType.get("clock")).toBe(false);
			expect(byType.get("weather")).toBe(true);
		} finally {
			clientWidgets.delete("clock" as WidgetType);
			clientWidgets.delete("weather" as WidgetType);
		}
	});

	it("renders a placeholder for unimplemented widgets", async () => {
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "unknown-widget" as unknown as WidgetType,
								config: { type: "unknown-widget" },
								data: null,
							},
						],
					},
				],
			}),
		);
		expect(await screen.findByText(/unknown-widget.*not implemented/i)).toBeInTheDocument();
	});

	it("passes the widget error through to the component", async () => {
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock" }, data: null, error: "boom" }],
					},
				],
			}),
		);
		const err = await screen.findByTestId("widget-error");
		expect(err).toHaveTextContent("boom");
	});

	it("renders group children as tabs", async () => {
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "group",
								config: { type: "group" },
								data: null,
								widgets: [
									{ type: "clock", config: { type: "clock", title: "Tab A" }, data: null },
									{ type: "clock", config: { type: "clock", title: "Tab B" }, data: null },
								],
							},
						],
					},
				],
			}),
		);
		expect((await screen.findAllByText("Tab A")).length).toBeGreaterThan(0);
		expect(screen.getAllByText("Tab B").length).toBeGreaterThan(0);
		// first tab active by default
		expect(screen.getByTestId("clock-widget")).toBeInTheDocument();
	});

	/** The selected tab has to survive the group losing children under it. A
	 *  config edit or a reload that drops the last child left `active` pointing
	 *  at a Tab that no longer existed: no selection in the strip and an empty
	 *  panel below, so the whole group read as blank. */
	it("keeps the panel on a tab that still exists when the group shrinks", async () => {
		vi.useFakeTimers();
		const groupOf = (titles: string[]) =>
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "group",
								config: { type: "group" },
								data: null,
								widgets: titles.map((t) => ({
									type: "clock" as const,
									config: { type: "clock", title: t },
									data: null,
								})),
							},
						],
					},
				],
			});
		let current = groupOf(["Tab A", "Tab B", "Tab C"]);
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify(current), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			),
		);
		render(
			<MemoryRouter>
				<PageView slug="home" />
			</MemoryRouter>,
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10);
		});
		fireEvent.click(screen.getByRole("button", { name: "Tab C" }));
		expect(screen.getAllByText("Tab C").length).toBeGreaterThan(1);

		// The group loses its last child on the next refetch.
		current = groupOf(["Tab A", "Tab B"]);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(31_000);
		});
		await act(async () => {
			window.dispatchEvent(new Event("focus"));
			await vi.advanceTimersByTimeAsync(10);
		});
		expect(screen.queryByRole("button", { name: "Tab C" })).toBeNull();
		// The panel is on the last surviving child, not empty.
		expect(screen.getByTestId("clock-widget")).toHaveTextContent("Tab B");
	});

	/** Before the per-widget boundary, a payload that threw while rendering
	 *  unmounted every widget on the page — one malformed field and the whole
	 *  dashboard went blank, with no card to say which widget did it. */
	it("degrades a widget that throws on its payload and keeps the rest of the page", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		registerWidgetComponent("clock" as WidgetType, ({ config }) => {
			if (config.title === "Exploding") {
				throw new TypeError("Cannot read properties of null (reading 'toLocaleString')");
			}
			return <div data-testid="clock-widget">{String(config.title)}</div>;
		});
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{ type: "clock", config: { type: "clock", title: "Exploding" }, data: null },
							{ type: "clock", config: { type: "clock", title: "Survivor" }, data: null },
						],
					},
				],
			}),
		);
		await screen.findByTestId("clock-widget");
		// The crash costs its own card, and the card names the widget.
		expect(screen.getByText("Exploding failed to render")).toBeInTheDocument();
		// The rest of the page is still there.
		expect(screen.getByTestId("clock-widget")).toHaveTextContent("Survivor");
	});

	/** A glance split-column with N children renders N tracks when max-columns
	 * allows it. The count reaches CSS as a custom property so the narrow-tile
	 * container query and the mobile fallback still own grid-template-columns. */
	function splitColumnEl(children: WidgetPayload[], maxColumns?: number): Promise<HTMLElement> {
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "split-column",
								config: {
									type: "split-column",
									...(maxColumns ? { "max-columns": maxColumns } : {}),
								},
								data: null,
								widgets: children,
							},
						],
					},
				],
			}),
		);
		return screen.findAllByTestId("clock-widget").then(() => {
			const el = document.querySelector('[class*="splitColumn"]') as HTMLElement | null;
			if (!el) throw new Error("split column not rendered");
			return el;
		});
	}

	const clockChild = (title: string): WidgetPayload => ({
		type: "clock",
		config: { type: "clock", title },
		data: null,
	});

	it("renders a 3-up split column and passes the track count to CSS", async () => {
		const el = await splitColumnEl([clockChild("A"), clockChild("B"), clockChild("C")], 3);
		expect(el.style.getPropertyValue("--split-cols")).toBe("3");
	});

	it("defaults a 3-child split column to 2 tracks", async () => {
		const el = await splitColumnEl([clockChild("A"), clockChild("B"), clockChild("C")]);
		expect(el.style.getPropertyValue("--split-cols")).toBe("2");
	});

	it("never renders more tracks than there are children", async () => {
		const el = await splitColumnEl([clockChild("A"), clockChild("B")], 5);
		expect(el.style.getPropertyValue("--split-cols")).toBe("2");
	});

	it("shows a page-level error when the fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response('{"error":"bad slug"}', { status: 404 })),
		);
		render(
			<MemoryRouter>
				<PageView slug="nope" />
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText("bad slug")).toBeInTheDocument());
	});

	it("keeps column sizes on the flex layout (no inline grid template)", async () => {
		renderPage(
			payload({
				columns: [
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
					{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		const widgets = await screen.findAllByTestId("clock-widget");
		expect(widgets).toHaveLength(2);
		const grid = document.querySelector('[class*="columns"]') as HTMLElement;
		// columns mode: flex row; sizing lives in .smallColumn/.fullColumn
		expect(grid?.className).not.toContain("autoTiling");
		expect(grid?.style.gridTemplateColumns).toBe("");
	});

	it("keeps the flex columns layout without auto tiling by default", async () => {
		renderPage(payload());
		await screen.findByTestId("clock-widget");
		const grid = document.querySelector('[class*="columns"]') as HTMLElement;
		expect(grid.className).not.toContain("autoTiling");
		// columns-mode: flex layout, sizing via .fullColumn/.smallColumn
		expect(grid.style.gridTemplateColumns).toBe("");
	});

	it("renders the auto tiling class, min-column-width var, and per-column data-span in auto mode", async () => {
		renderPage(
			payload({
				tiling: "auto",
				minColumnWidth: 340,
				columns: [
					{
						size: "small",
						span: 2,
						widgets: [{ type: "clock", config: { type: "clock" }, data: null }],
					},
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
					{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		const grid = document.querySelector('[class*="columns"]') as HTMLElement;
		expect(grid.className).toContain("autoTiling");
		expect(grid.style.getPropertyValue("--min-column-width")).toBe("340px");
		// small/full sizes are ignored in auto mode — the pinned inline
		// gridTemplateColumns is not applied (the CSS class drives the grid).
		expect(grid.style.gridTemplateColumns).toBe("");
		const tiles = Array.from(grid.querySelectorAll("[data-span]"));
		// span 1 is the default track — only spans above 1 emit the hint
		expect(tiles.map((t) => t.getAttribute("data-span"))).toEqual(["2"]);
	});

	it("sets the min-column-width var from the payload in auto mode", async () => {
		renderPage(
			payload({
				tiling: "auto",
				minColumnWidth: 300,
				columns: [
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		await screen.findByTestId("clock-widget");
		const grid = document.querySelector('[class*="columns"]') as HTMLElement;
		expect(grid.style.getPropertyValue("--min-column-width")).toBe("300px");
	});

	it("keeps the mobile collapse toggles in auto mode (columns stay DOM children)", async () => {
		renderPage(
			payload({
				tiling: "auto",
				columns: [
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		// By the column testid, not `[class*="mobileToggle"]` — that matches
		// nothing under vitest's hashed CSS-module proxy, so the count was 2 out
		// of an empty NodeList and the test could not fail.
		expect(screen.getAllByTestId("column-toggle")).toHaveLength(2);
	});

	// The mobile toggle used to read the first widget's title, so a page whose
	// columns were named unevenly listed "Column 1" / "Homelab — recent" /
	// "Column 3" as one stack of headers. A column's own `title` leads now, and
	// the fallbacks only fire in that order.
	it("labels the mobile column toggle column title, then first widget, then Column N", async () => {
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						title: "Homelab",
						widgets: [{ type: "clock", config: { type: "clock" }, data: null }],
					},
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Servers" }, data: null }],
					},
					{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		const labels = screen.getAllByTestId("column-toggle").map((t) => t.textContent?.trim());
		expect(labels).toEqual(["Homelab", "Servers", "Column 3"]);
	});

	it("renders the collage tiling class with place() tracks and row unit", async () => {
		renderPage(
			payload({
				tiling: "collage",
				minColumnWidth: 360,
				columns: [
					{
						size: "small",
						span: 2,
						widgets: [{ type: "clock", config: { type: "clock" }, data: null }],
					},
					{ size: "small", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
				],
			}),
		);
		await screen.findAllByTestId("clock-widget");
		const grid = document.querySelector('[class*="columns"]') as HTMLElement;
		expect(grid.className).toContain("collageTiling");
		// tracks + row unit come from place(), not the measure pass: 12 desktop
		// tracks at jsdom width, 96px rows; min-column-width is auto-mode only
		expect(grid.style.gridTemplateColumns).toBe("repeat(12, minmax(0, 1fr))");
		expect(grid.style.getPropertyValue("--tile-row")).toBe("96px");
		expect(grid.style.getPropertyValue("--min-column-width")).toBe("");
		// span hints still emit their column footprint in collage mode
		const tiles = Array.from(grid.querySelectorAll("[data-span]"));
		expect(tiles.map((t) => t.getAttribute("data-span"))).toEqual(["2"]);
	});

	it("emits placed row spans on collage skeleton tiles", () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise(() => {})),
		);
		const page: Page & { slug: string } = {
			slug: "home",
			name: "Home",
			tiling: "collage",
			"min-column-width": 360,
			columns: [
				// tall feed (limit > 5) + markets PREF rows: 3 + 1 = 4
				{
					size: "full",
					widgets: [
						{
							type: "rss",
							title: "Feeds",
							feeds: [{ url: "https://example.com/feed.xml" }],
							limit: 10,
							retries: 3,
							"show-errors": true,
						},
						{
							type: "markets",
							title: "Markets",
							markets: [{ symbol: "SPY" }],
							retries: 3,
							"show-errors": true,
						},
					],
				},
				// clock PREF rows: 2
				{
					size: "small",
					widgets: [
						{ type: "clock", title: "Clock", timezones: [], retries: 3, "show-errors": true },
					],
				},
				// group container PREF rows: 3
				{
					size: "small",
					widgets: [
						{
							type: "group",
							title: "Group",
							retries: 3,
							"show-errors": true,
							widgets: [{ type: "clock", title: "Child" }],
						},
					],
				},
			],
		};
		render(
			<MemoryRouter>
				<PageView slug="home" page={page} />
			</MemoryRouter>,
		);
		expect(screen.queryByTestId("page-skeleton")).toBeNull();
		act(() => {
			vi.advanceTimersByTime(260);
		});
		const skeleton = screen.getByTestId("page-skeleton");
		const grid = skeleton.querySelector('[class*="columns"]') as HTMLElement;
		expect(grid.className).toContain("collageTiling");
		// skeleton geometry is place() output: 12 desktop tracks, 96px rows
		expect(grid.style.gridTemplateColumns).toBe("repeat(12, minmax(0, 1fr))");
		expect(grid.style.getPropertyValue("--tile-row")).toBe("96px");
		const spans = Array.from(grid.querySelectorAll("[data-row-span]")).map((t) =>
			t.getAttribute("data-row-span"),
		);
		// feed(3)+markets(1)=4; clock PREF rows=2; group PREF rows=3
		expect(spans).toEqual(["4", "2", "3"]);
	});

	it("renders a mobile page-name header when show-mobile-header is set", async () => {
		renderPage(payload({ name: "My Page", "show-mobile-header": true }));
		// `findByText` is the real check; `className.toContain('mobileHeader')`
		// froze a hashed class for a property jsdom cannot see.
		expect(await screen.findByText("My Page")).toBeInTheDocument();
	});

	it("does not render the mobile header by default", async () => {
		renderPage(payload());
		await screen.findByTestId("clock-widget");
		expect(screen.queryByText("Home")).toBeNull();
	});

	it("opens the active group tab title-url in a new tab", async () => {
		const openSpy = vi.fn();
		vi.stubGlobal("open", openSpy);
		renderPage(
			payload({
				columns: [
					{
						size: "full",
						widgets: [
							{
								type: "group",
								config: {
									type: "group",
									"title-url": "https://example.com/group",
								},
								data: null,
								widgets: [
									{
										type: "clock",
										config: { type: "clock", title: "Tab A" },
										data: null,
									},
									{ type: "clock", config: { type: "clock", title: "Tab B" }, data: null },
								],
							},
						],
					},
				],
			}),
		);
		// tab A is active by default — clicking it opens the group's title-url
		fireEvent.click(await screen.findByRole("button", { name: "Tab A" }));
		expect(openSpy).toHaveBeenCalledWith(
			"https://example.com/group",
			"_blank",
			"noopener,noreferrer",
		);

		// clicking tab B switches to it and opens nothing
		fireEvent.click(screen.getByRole("button", { name: "Tab B" }));
		expect(openSpy).toHaveBeenCalledTimes(1);
		// content switched to tab B (clock title 'Tab B' now rendered in body)
		expect(screen.getAllByText("Tab B").length).toBeGreaterThan(1);

		// clicking tab B again (now active) opens the group title-url
		fireEvent.click(screen.getByRole("button", { name: "Tab B" }));
		expect(openSpy).toHaveBeenCalledTimes(2);
	});

	it("hides desktop navigation and constrains nav width from the page config", async () => {
		renderApp("/");
		await screen.findByTestId("clock-widget");
		const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
		expect(wrapper.className).toContain("hideDesktopNav");
		const nav = wrapper.querySelector('nav[aria-label="Pages"]') as HTMLElement;
		expect(nav.style.maxWidth).toBe("1100px");
	});

	it("keeps desktop navigation visible when the page does not hide it", async () => {
		renderApp("/docs");
		await screen.findByTestId("clock-widget");
		const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
		expect(wrapper.className).not.toContain("hideDesktopNav");
		const nav = wrapper.querySelector('nav[aria-label="Pages"]') as HTMLElement;
		expect(nav.style.maxWidth).toBe("");
	});

	it("redirects an unknown slug to the home page", async () => {
		renderApp("/nonsense");
		await screen.findByTestId("clock-widget");
		// After the redirect the active page is home, whose config hides the
		// desktop navigation — the wrapper class proves the fallback config was
		// not used and no error banner for a 404'd page payload was rendered.
		const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
		expect(wrapper.className).toContain("hideDesktopNav");
		expect(screen.queryByText("page not found")).toBeNull();
	});

	it("social collage page has bottom padding and align-content start", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		expect(css).toMatch(/\.page\s*\{[^}]*padding-block:\s*var\(--space-gap\)/);
		expect(css).toMatch(/\.collageTiling\s*\{[^}]*align-content:\s*start/);
		expect(css).toMatch(/\.splitColumn\s*\{[^}]*gap:\s*var\(--(widget-gap|space-gap)\)/);
	});

	it("page layout has no entrance choreography and no shadow-based depth", () => {
		for (const file of [
			"src/client/pages/page.module.css",
			"src/client/components/top-nav.module.css",
		]) {
			const css = readFileSync(file, "utf8");
			// Motion answers action: nothing animates itself in.
			expect(css).not.toMatch(/animation(-name)?\s*:/);
			// Flat and crisp: depth comes from borders, never a shadow.
			for (const value of css.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
				expect(value[1].trim().startsWith("none")).toBe(true);
			}
			// No pills: no radius at or beyond half the element.
			expect(css).not.toMatch(/border-radius\s*:\s*(50%|999)/);
		}
	});

	it("one collapse toggle per column, labelled below the widget headings", () => {
		const page = {
			slug: "home",
			name: "Home",
			width: "default",
			tiling: "columns",
			headWidgets: [],
			columns: [
				{ size: "full", widgets: [{ type: "clock", title: "Clock" }] },
				{ size: "full", widgets: [{ type: "clock", title: "Weather" }] },
			],
		} as unknown as Page & { slug: string };

		render(<PageSkeleton page={page} />);
		// One toggle per column, by testid: `[class*="mobileToggle"]` matches
		// nothing under vitest's hashed CSS-module proxy.
		const toggles = screen.getAllByTestId("column-toggle");
		expect(toggles).toHaveLength(2);
		// The two-tier hierarchy: the widget headers are the level-3 headings and
		// the column label is not one of them, so it cannot compete for their
		// size. (The old `[class*="supporting"]` check froze an
		// @astryxdesign/core class name.)
		expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
		expect(toggles[0].querySelector("h3, h4, h5, h6")).toBeNull();
	});

	it("page content has uniform bottom gap regardless of tiling", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		// .page must keep both padding-block and explicit padding-bottom (calc allowed) so collage stretch can't collapse the footer gap
		expect(css).toMatch(
			/\.page\s*\{[^}]*padding-bottom:\s*(var\(--(space-gap|widget-gap)\)|calc\(var\(--(space-gap|widget-gap)\))/,
		);
		expect(css).toMatch(/\.autoTiling\s*\{[^}]*align-content:\s*start/);
	});
	it("skeleton mirrors columns (no CLS)", () => {
		const page = {
			slug: "home",
			name: "Home",
			columns: [
				{ size: "full" as const, widgets: [{ type: "clock" as const, title: "A" }] },
				{ size: "full" as const, widgets: [{ type: "clock" as const, title: "B" }] },
			],
			tiling: "columns" as const,
			"min-column-width": 320,
		} as unknown as Page & { slug: string };
		const { container } = render(
			<MemoryRouter>
				<PageSkeleton page={page} />
			</MemoryRouter>,
		);
		expect(container.querySelectorAll('[data-testid="column"]')).toHaveLength(2);
	});

	it("collage tiles carry their placed row spans from the single table", async () => {
		renderPage(
			payload({
				tiling: "collage",
				minColumnWidth: 300,
				columns: [
					{ size: "full", widgets: [{ type: "clock", config: { type: "clock" }, data: null }] },
					{ size: "full", widgets: [{ type: "videos", config: { type: "videos" }, data: null }] },
					{ size: "full", widgets: [{ type: "monitor", config: { type: "monitor" }, data: null }] },
				],
			}),
		);
		await screen.findByTestId("clock-widget");
		const grid = document.querySelector('[class*="collageTiling"]') as HTMLElement;
		// clock/videos/monitor PREF rows are all 2: every tile spans 2 rows
		const spans = Array.from(grid.querySelectorAll("[data-row-span]")).map((t) =>
			t.getAttribute("data-row-span"),
		);
		expect(spans).toEqual(["2", "2", "2"]);
	});

	it("flat widgets render the bento grid with compositor placements", async () => {
		renderPage(
			payload({
				columns: [],
				widgets: [
					{
						type: "clock",
						config: { type: "clock", title: "Clock", priority: 9, zone: "sidebar" },
						data: null,
					},
					{ type: "clock", config: { type: "clock", title: "Second", span: 2 }, data: null },
				],
				gridColumns: 12,
				gridRowHeight: 96,
			}),
		);
		const grid = await screen.findByTestId("bento-grid");
		expect(grid.className).toContain("bentoGrid");
		expect(grid.style.getPropertyValue("--bento-cols")).toBe("12");
		expect(grid.style.getPropertyValue("--bento-row")).toBe("96px");
		expect(within(grid).getAllByTestId("clock-widget")).toHaveLength(2);
		// Exactly one placement per tile, from place(). A `>= 2` bound passes for
		// any fixture this test itself built.
		expect(grid.querySelectorAll("[data-bento-x]")).toHaveLength(2);
	});

	it("legacy columns pages still render MobileColumn (no bento grid)", async () => {
		// renders alongside the bento page above — scope to the newest column
		// wrapper (RTL auto-cleanup unmounts previous trees only via its own
		// afterEach, and this file relies on manual scoping elsewhere too).
		const { container } = renderPage(payload());
		await waitFor(() => {
			expect(within(container).getAllByTestId("clock-widget").length).toBeGreaterThan(0);
		});
		expect(within(container).queryByTestId("bento-grid")).toBeNull();
		expect(within(container).getByTestId("column")).toBeInTheDocument();
	});

	it("flat page skeleton mirrors the bento grid at 12 columns", () => {
		const page = {
			slug: "home",
			name: "Home",
			widgets: [
				{ type: "clock", title: "A" },
				{ type: "rss", title: "B" },
			],
		} as unknown as Page & { slug: string };
		render(
			<MemoryRouter>
				<PageSkeleton page={page} />
			</MemoryRouter>,
		);
		const sk = screen.getByTestId("bento-skeleton");
		expect(sk.style.getPropertyValue("--bento-cols")).toBe("12");
		// `[class*="bentoItem"]` matches nothing under the hashed CSS-module proxy.
		// `data-resizable` is always emitted, so it counts real items.
		expect(sk.querySelectorAll("[data-resizable]")).toHaveLength(2);
	});

	it("bento css: 12-col dense grid collapsing to one track on mobile", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		expect(css).toMatch(/\.bentoGrid\s*\{[^}]*repeat\(var\(--bento-cols,\s*12\)/);
		expect(css).toMatch(/\.bentoGrid\s*\{[^}]*grid-auto-flow:\s*dense/);
		// mobile collapse lives in the ≤768px media query (!important beats the
		// earlier-in-file base rule and the inline --bento-* placement vars)
		expect(css).toMatch(/\.bentoGrid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/);
		expect(css).toMatch(/\.bentoItem\s*\{[^}]*grid-column:\s*1\s*\/\s*-1\s*!important/);
		expect(css).toMatch(/\.bentoItem\s*\{[^}]*grid-row:\s*auto\s*!important/);
	});

	it("columns css: 12-col grid, --col-span sizing, mobile collapse to full width", () => {
		const css = readFileSync("src/client/pages/page.module.css", "utf8");
		expect(css).toMatch(
			/\.columns\s*\{[^}]*display:\s*grid[^}]*repeat\(12,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*(var\(--widget-gap\)|clamp\([^)]*\))[^}]*align-content:\s*start/,
		);
		expect(css).toMatch(/\.column\s*\{[^}]*grid-column:\s*span var\(--col-span,\s*12\)/);
		// Tablet: the track count follows the span vocabulary, not the reverse.
		// --col-span is a 12-col unit, so `.columns` keeps all 12 tracks through
		// the band. Both halves of the P1 regression (a 6-track `.columns` grid,
		// and a hand remap of the spans into 6-track space) are guarded here:
		// re-adding either one strands a void in every row (34-51% dead space).
		const tablet = css.slice(
			css.indexOf("@media (max-width: 900px)"),
			css.indexOf("@media", css.indexOf("@media (max-width: 900px)") + 1),
		);
		expect(tablet).not.toMatch(/\.columns\b/);
		expect(css).not.toMatch(/--col-span:\s*(?!12\b)\d/);
		// The one 6-track grid that is still right: auto-fit, whose spans are
		// track hints rather than 12-col units, so nothing to re-derive.
		expect(tablet).toMatch(
			/\.autoTiling\s*\{\s*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/,
		);
		const media = css.slice(css.indexOf("@media (max-width: 600px)"));
		expect(media).toMatch(/\.columns \.column\s*\{[^}]*grid-column:\s*1 \/ -1/);
	});

	it("Social 4/8 columns map to spans (--col-span)", async () => {
		renderPage(
			payload({
				slug: "social",
				name: "Social",
				tiling: "columns",
				columns: [
					{
						size: "full",
						span: 4,
						widgets: [{ type: "clock", config: { type: "clock", title: "Left" }, data: null }],
					},
					{
						size: "full",
						span: 8,
						widgets: [{ type: "clock", config: { type: "clock", title: "Right" }, data: null }],
					},
				],
			}),
		);
		// wait past the loading-fallback column: only the fetched payload's
		// two grid columns carry --col-span
		await waitFor(() => expect(screen.getAllByTestId("column")).toHaveLength(2));
		const cols = screen.getAllByTestId("column");
		expect(cols[0].style.getPropertyValue("--col-span")).toBe("4");
		expect(cols[1].style.getPropertyValue("--col-span")).toBe("8");
	});

	it("does not render skeleton before 250ms", () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise(() => {})),
		);
		const page: Page & { slug: string } = {
			slug: "home",
			name: "Home",
			tiling: "auto",
			columns: [{ size: "full", widgets: [{ type: "clock", title: "Clock" }] }],
		} as unknown as Page & { slug: string };
		render(
			<MemoryRouter>
				<PageView slug="home" page={page} />
			</MemoryRouter>,
		);
		expect(screen.queryByTestId("page-skeleton")).toBeNull();
		act(() => {
			vi.advanceTimersByTime(260);
		});
		expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
	});

	it("size-derived spans map via resolveSpan (full+small → 9/3)", async () => {
		renderPage(
			payload({
				tiling: "columns",
				columns: [
					{
						size: "full",
						widgets: [{ type: "clock", config: { type: "clock", title: "Wide" }, data: null }],
					},
					{
						size: "small",
						widgets: [{ type: "clock", config: { type: "clock", title: "Narrow" }, data: null }],
					},
				],
			}),
		);
		await waitFor(() => expect(screen.getAllByTestId("column")).toHaveLength(2));
		const cols = screen.getAllByTestId("column");
		expect(cols[0].style.getPropertyValue("--col-span")).toBe("9");
		expect(cols[1].style.getPropertyValue("--col-span")).toBe("3");
	});
});
