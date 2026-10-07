import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen } from "@testing-library/react";
import { CHART_HUES } from "astryx-dracula/shared/chart-hues";
import { describe, expect, it } from "vitest";
import type { DnsStats } from "../../../shared/widgets/payloads";
import styles from "./dns.module.css";
import { DnsStatsWidget } from "./index";

// Vitest serves CSS modules as a class-name proxy, so the token bindings are
// only observable in the stylesheet source itself.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "dns.module.css"), "utf8");

function sample(overrides: Partial<DnsStats> = {}): DnsStats {
	const series = Array.from({ length: 8 }, (_, i) => ({
		queries: 100 + i * 10,
		blocked: 20 + i,
		percentBlocked: 20,
		percentTotal: i === 7 ? 100 : 80 - i * 5,
	}));
	return {
		totalQueries: 1234,
		blockedPercent: 23,
		responseTime: 0,
		domainsBlocked: 120_000,
		series,
		timeLabels: ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"],
		topBlockedDomains: [
			{ domain: "ads.example", percentBlocked: 40 },
			{ domain: "track.example", percentBlocked: 10 },
		],
		...overrides,
	};
}

const baseConfig = { type: "dns-stats", title: "DNS", url: "http://pi.local" } as unknown as Record<
	string,
	unknown
>;

describe("DnsStats client", () => {
	it("renders totals: QUERIES/BLOCKED/DOMAINS when responseTime is 0", () => {
		render(
			<DnsStatsWidget
				config={baseConfig}
				data={sample({ responseTime: 0, domainsBlocked: 50_000 })}
			/>,
		);
		// One in the totals row, one in each of the 8 per-bar tips. A
		// `toBeGreaterThan(0)` here pinned neither the count nor the structure.
		expect(screen.getAllByText("QUERIES")).toHaveLength(9);
		expect(screen.getAllByText("BLOCKED")).toHaveLength(9);
		expect(screen.getByText("DOMAINS")).toBeInTheDocument();
		expect(screen.getByTestId("dns-total").textContent).toMatch(/1,234/);
		expect(screen.getByTestId("dns-blocked").textContent).toBe("23%");
		expect(screen.getByTestId("dns-domains").textContent).toMatch(/50/);
	});

	it("renders LATENCY instead of DOMAINS when responseTime > 0", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample({ responseTime: 12 })} />);
		expect(screen.getByText("LATENCY")).toBeInTheDocument();
		expect(screen.queryByText("DOMAINS")).not.toBeInTheDocument();
		expect(screen.getByTestId("dns-latency").textContent).toMatch(/12ms/);
	});

	it("gives every bar an accessible name and a keyboard stop", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const cols = screen.getAllByTestId("dns-column");
		expect(screen.getByRole("region", { name: /by hour/ })).toBeInTheDocument();
		expect(cols[0].tagName).toBe("BUTTON");
		// The button carries its own accessible name (no inner role=img indirection)
		expect(cols.map((n) => n.getAttribute("aria-label"))).toEqual([
			"12am: 100 queries, 20% blocked",
			"3am: 110 queries, 20% blocked",
			"6am: 120 queries, 20% blocked",
			"9am: 130 queries, 20% blocked",
			"12pm: 140 queries, 20% blocked",
			"3pm: 150 queries, 20% blocked",
			"6pm: 160 queries, 20% blocked",
			"9pm: 170 queries, 20% blocked",
		]);
		// the tip repeats what the label says — announcing both would double it
		expect(screen.getAllByTestId("dns-tip")[0]).toHaveAttribute("aria-hidden", "true");
	});

	it("pins a bar on tap, so the readout is reachable without a pointer", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const cols = screen.getAllByTestId("dns-column");
		expect(cols[3]).not.toHaveAttribute("data-active");
		fireEvent.click(cols[3]);
		expect(cols[3]).toHaveAttribute("data-active", "true");
		fireEvent.click(cols[5]);
		expect(cols[3]).not.toHaveAttribute("data-active");
		expect(cols[5]).toHaveAttribute("data-active", "true");
		// tapping the same bar again, or losing focus, releases it
		fireEvent.click(cols[5]);
		expect(cols[5]).not.toHaveAttribute("data-active");
		fireEvent.click(cols[2]);
		fireEvent.blur(cols[2]);
		expect(cols[2]).not.toHaveAttribute("data-active");
	});

	it("Escape releases a pinned bar", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const cols = screen.getAllByTestId("dns-column");
		fireEvent.click(cols[1]);
		expect(cols[1]).toHaveAttribute("data-active", "true");
		fireEvent.keyDown(cols[1], { key: "Escape" });
		expect(cols[1]).not.toHaveAttribute("data-active");
	});

	it("never dims the headline totals, and never dims the unfocused bars", () => {
		// The channels and the totals dim are CSS-only, so the stylesheet is the
		// surface under test. Asserting the *prohibition* is the point — the three
		// reveal channels (:hover, :focus-visible, [data-active]) are already
		// covered behaviourally by the tap and Escape tests above, and pinning
		// their exact selector spelling would fire on a reformat.
		expect(css).not.toMatch(/\.totals[^{]*\{[^}]*opacity:\s*0?\.1/);
		expect(css).not.toContain(":has(.column:hover) .totals");
		expect(css).not.toContain(".columns:hover .column:not(:hover) .time");
	});

	it("renders graph with 8 columns and per-bar tips", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const cols = screen.getAllByTestId("dns-column");
		expect(cols).toHaveLength(8);
		expect(screen.getByTestId("dns-graph")).toBeInTheDocument();
		expect(screen.getAllByTestId("dns-tip")[0].textContent).toMatch(/QUERIES/);
		expect(screen.getAllByTestId("dns-bar")).toHaveLength(8);
		expect(screen.getAllByTestId("dns-time")[0].textContent).toBe("12am");
	});

	it("hides graph when hide-graph is true", () => {
		render(<DnsStatsWidget config={{ ...baseConfig, "hide-graph": true }} data={sample()} />);
		expect(screen.queryByTestId("dns-graph")).not.toBeInTheDocument();
	});

	it("hides graph when series is empty", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample({ series: [] })} />);
		expect(screen.queryByTestId("dns-graph")).not.toBeInTheDocument();
	});

	it("renders top blocked domains and toggles details", () => {
		render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const details = screen.getByTestId("dns-details");
		expect(details).toBeInTheDocument();
		expect(screen.getByText("Top blocked domains")).toBeInTheDocument();
		expect(screen.getByText("ads.example")).toBeInTheDocument();
		expect(screen.getAllByTestId("dns-domain-row")).toHaveLength(2);
		expect(screen.getAllByTestId("dns-domain-row")[0].textContent).toMatch(/40%/);
	});

	it("hides top domains when hide-top-domains is true", () => {
		render(<DnsStatsWidget config={{ ...baseConfig, "hide-top-domains": true }} data={sample()} />);
		expect(screen.queryByTestId("dns-details")).not.toBeInTheDocument();
	});

	it("suppresses a real payload while loading", () => {
		// `data={null}` would take the early return anyway, and the `!d` fallback
		// also omits dns-root — so the original assertion could not fail. Real
		// data is what isLoading has to suppress.
		render(<DnsStatsWidget config={baseConfig} data={sample()} isLoading />);
		expect(screen.queryByTestId("dns-root")).not.toBeInTheDocument();
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces error", () => {
		render(<DnsStatsWidget config={baseConfig} data={null} error="dns fetch failed" />);
		expect(screen.getByText("dns fetch failed")).toBeInTheDocument();
	});

	it("svg gridlines have 5 lines at 1,25,50,75,99", () => {
		const { container } = render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const lines = container.querySelectorAll("svg line");
		expect(lines).toHaveLength(5);
		const ys = Array.from(lines).map((l) => l.getAttribute("y1"));
		expect(ys).toEqual(["1", "25", "50", "75", "99"]);
	});

	it("bar segments carry the queries and blocked marks", () => {
		const { container } = render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const bar = container.querySelector('[data-testid="dns-bar"]')!;
		expect(bar.querySelector(`.${styles.queries}`)).not.toBeNull();
		expect(bar.querySelector(`.${styles.blocked}`)).not.toBeNull();
	});

	it("paints the graph grid with the gridline token", () => {
		const { container } = render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		expect(container.querySelector("svg g")).toHaveAttribute(
			"stroke",
			"var(--color-graph-gridlines)",
		);
	});

	it("paints the bars with the kit CHART_HUES over a 10% wash with semantic borders", () => {
		const { container } = render(<DnsStatsWidget config={baseConfig} data={sample()} />);
		const bar = container.querySelector('[data-testid="dns-bar"]')!;
		// hues come from the kit's CHART_HUES, never from a hand-picked token
		expect(bar.querySelector(`.${styles.queries}`)).toHaveStyle({ "--bar-hue": CHART_HUES.cyan });
		expect(bar.querySelector(`.${styles.blocked}`)).toHaveStyle({ "--bar-hue": CHART_HUES.orange });
		const rule = (selector: string) =>
			css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
		expect(rule("\\.bar > \\*")).toContain("var(--bar-hue) 10%");
		expect(rule("\\.bar > \\*")).toContain("border-top: 1px solid var(--bar-hue)");
		// the stylesheet declares no hue of its own, and never a literal colour
		expect(rule("\\.bar > \\*")).not.toMatch(/#[0-9a-fA-F]{3,8}/);
		expect(css).not.toMatch(/--bar-hue:\s*var/);
		// washes replace the old direct fills, and no entrance choreography
		expect(css).not.toContain("--color-vertical-progress-value");
		expect(css).not.toContain("--color-negative");
		expect(css).not.toContain("animation");
	});
});
