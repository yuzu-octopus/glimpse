import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Iframe, { Html as HtmlWidget } from "./index";
import styles from "./iframe.module.css";

describe("iframe widget", () => {
	it("renders the source frameless with the configured height as min-height", () => {
		render(
			<Iframe
				config={{ type: "iframe", title: "Embed", source: "https://example.com", height: 200 }}
				data={null}
			/>,
		);
		const frame = screen.getByTitle("Embed") as HTMLIFrameElement;
		expect(frame.getAttribute("src")).toBe("https://example.com");
		expect(frame.getAttribute("height")).toBeNull();
		expect(frame.style.minHeight).toBe("200px");
	});

	it("defaults the min-height when no height is configured", () => {
		render(<Iframe config={{ type: "iframe", source: "https://example.com" }} data={null} />);
		const frame = screen.getByTitle("Embedded content") as HTMLIFrameElement;
		expect(frame.style.minHeight).toBe("300px");
	});

	it("renders the title as a link when title-url is set", () => {
		render(
			<Iframe
				config={{
					type: "iframe",
					title: "Embed",
					source: "https://example.com",
					"title-url": "https://example.com",
				}}
				data={null}
			/>,
		);
		const link = screen.getByRole("link", { name: "Embed" });
		expect(link).toHaveAttribute("href", "https://example.com");
	});

	it("hides the header when hide-header is set", () => {
		render(
			<Iframe
				config={{
					type: "iframe",
					title: "Embed",
					source: "https://example.com",
					"hide-header": true,
				}}
				data={null}
			/>,
		);
		expect(screen.queryByText("Embed")).toBeNull();
	});

	it("applies css-class to the widget", () => {
		const { container } = render(
			<Iframe
				config={{
					type: "iframe",
					title: "Embed",
					source: "https://example.com",
					"css-class": "my-class",
				}}
				data={null}
			/>,
		);
		expect(container.querySelector(".my-class")).toBeInTheDocument();
	});

	it("handles special characters in title", () => {
		render(
			<Iframe
				config={{
					type: "iframe",
					title: 'Test <script> & "quotes"',
					source: "https://example.com",
				}}
				data={null}
			/>,
		);
		expect(screen.getByTitle('Test <script> & "quotes"')).toBeInTheDocument();
	});
});

describe("html widget overflow containment", () => {
	const css = readFileSync("src/client/widgets/iframe/iframe.module.css", "utf8");

	it("wraps author markup in a wrapping scrollport and caps wide descendants", () => {
		render(
			<HtmlWidget
				config={{ type: "html", source: "<table><tr><td>very-wide-cell</td></tr></table>" }}
				data={null}
			/>,
		);
		const wrapper = screen.getByText("very-wide-cell").closest("div");
		expect(wrapper?.className).toContain(styles.html);
		expect(css).toMatch(/\.html\s*\{[^}]*overflow-x:\s*auto/);
		expect(css).toMatch(/\.html\s*\{[^}]*overflow-wrap:\s*anywhere/);
		expect(css).toMatch(
			/\.html\s+img\s*,\s*\.html\s+table\s*,\s*\.html\s+pre\s*,\s*\.html\s+video\s*\{[^}]*max-width:\s*100%/,
		);
	});
});
