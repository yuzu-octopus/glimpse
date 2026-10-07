import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedConfig } from "../../shared/config";
import { GlimpseThemeProvider } from "../theme/GlimpseThemeProvider";
import { MobileNavigation, TopNav } from "./TopNav";

const config = {
	pages: [
		{ name: "Home", slug: "home", width: "default", columns: [] },
		{ name: "Dev", slug: "dev", width: "default", columns: [] },
	],
} as unknown as ResolvedConfig;

vi.mock("../hooks/useConfig", () => ({
	useConfig: () => ({ status: "ready", config }),
}));

const prefetch = vi.fn();
vi.mock("../hooks/usePageData", () => ({
	prefetchPage: (slug: string) => prefetch(slug),
}));

function renderNav(node: React.ReactNode, path = "/") {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<GlimpseThemeProvider>{node}</GlimpseThemeProvider>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	prefetch.mockClear();
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
	vi.unstubAllGlobals();
});

describe("TopNav", () => {
	it("renders every configured page as a real link and marks the current one", () => {
		renderNav(<TopNav />, "/dev");

		const nav = screen.getByRole("navigation", { name: "Pages" });
		const home = within(nav).getByRole("link", { name: "Home" });
		const dev = within(nav).getByRole("link", { name: "Dev" });

		expect(home).toHaveAttribute("href", "/");
		expect(dev).toHaveAttribute("href", "/dev");
		expect(dev).toHaveAttribute("aria-current", "page");
		expect(home).not.toHaveAttribute("aria-current");
	});

	it("treats the home slug as current on its own path too", () => {
		renderNav(<TopNav />, "/home");
		const nav = screen.getByRole("navigation", { name: "Pages" });
		expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
	});

	it("prefetches a page on hover and on keyboard focus", () => {
		renderNav(<TopNav />);
		const dev = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", {
			name: "Dev",
		});

		dev.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
		expect(prefetch).toHaveBeenCalledWith("dev");

		// Focus is the only path a keyboard-only user takes; the old version
		// never dispatched it, so deleting TopNav's onFocus would not fail.
		prefetch.mockClear();
		fireEvent.focus(dev);
		expect(prefetch).toHaveBeenCalledWith("dev");
	});

	it("keeps the logo a real outbound anchor, not a button", () => {
		renderNav(<TopNav />);
		const logo = screen.getByRole("link", { name: "Glimpse on GitHub (opens in new tab)" });
		expect(logo.tagName).toBe("A");
		expect(logo).toHaveAttribute("href", "https://github.com/yuzu-octopus/glimpse");
		expect(logo).toHaveAttribute("rel", expect.stringContaining("noopener"));
	});
});

describe("MobileNavigation", () => {
	it("collapses the page list until the menu button is pressed", () => {
		renderNav(<MobileNavigation />);
		const bar = screen.getByTestId("mobile-navigation");
		const toggle = within(bar).getByRole("button", { name: "Pages" });

		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(within(bar).queryByRole("link", { name: "Dev" })).toBeNull();

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(within(bar).getByRole("link", { name: "Dev" })).toHaveAttribute("href", "/dev");
	});
});
