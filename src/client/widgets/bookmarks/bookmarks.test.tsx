import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bookmarksSchema } from "../../../shared/widgets/bookmarks";
import { resolveIcon } from "../../../shared/widgets/icon";
import styles from "./bookmarks.module.css";
import Bookmarks from "./index";

describe("bookmarks widget", () => {
	it("renders group titles and link cards", () => {
		render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [{ title: "Dev", links: [{ title: "GitHub", url: "https://github.com" }] }],
				}}
			/>,
		);
		expect(screen.getByText("Dev")).toBeInTheDocument();
		expect(screen.getByText("GitHub")).toBeInTheDocument();
		// astryx's ListItem is the row: a list item carrying the group's real
		// link, rather than a Link anchor that had its children flattened back
		// out with `display: contents`.
		const row = screen.getByRole("link", { name: "GitHub" }).closest("li")!;
		expect(row).not.toBeNull();
		expect(row.parentElement?.tagName).toBe("UL");
	});

	it("renders icons and descriptions when present", () => {
		render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{
							links: [
								{
									title: "Docs",
									url: "https://docs.example.com",
									icon: "https://example.com/icon.png",
									description: "API reference",
								},
							],
						},
					],
				}}
			/>,
		);
		// the icon is the item's start slot and the description its own, so the
		// whole row is the link's target
		const row = screen.getByRole("link", { name: /API reference/ }).closest("li")!;
		expect(row.querySelector(`.${styles.icon}`)).not.toBeNull();
		expect(screen.getByText("API reference")).toBeInTheDocument();
	});

	it("gives the same bookmark the same icon accent wherever it is listed", () => {
		const link = { title: "GitHub", url: "https://github.com", icon: "https://example.com/i.png" };
		const { container: first } = render(
			<Bookmarks data={null} config={{ type: "bookmarks", groups: [{ links: [link] }] }} />,
		);
		const { container: second } = render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [{ links: [{ title: "Pad", url: "https://pad.example" }, link] }],
				}}
			/>,
		);
		const accent = (root: HTMLElement) => root.querySelector(`.${styles.iconContainer}`)?.className;
		// the same link, second position in the second group: the accent must not
		// follow DOM position the way the old nth-child(6n+N) cycle made it
		expect(accent(second)).toBe(accent(first));
	});

	it("resolves the si: shorthand to a simple-icons URL, the way glance does", () => {
		// config.example.yml ships si:grafana; rendering it verbatim made the
		// browser ask our own SPA for /si:grafana, get HTML back, and paint a
		// broken-image glyph. The shorthand is a real glance feature, so it
		// resolves here rather than being quietly dropped from the example config.
		expect(resolveIcon("si:grafana")).toEqual({
			src: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/grafana.svg",
			// black path on a dark-only theme
			autoInvert: true,
		});
	});

	it("takes a URL as the icon, and never mistakes its scheme for a shorthand", () => {
		expect(resolveIcon("https://example.com/icon.png")).toEqual({
			src: "https://example.com/icon.png",
			autoInvert: false,
		});
		expect(resolveIcon("http://box.lab:8080/i.svg")).toEqual({
			src: "http://box.lab:8080/i.svg",
			autoInvert: false,
		});
	});

	it("inverts on request, with a URL or another shorthand behind it", () => {
		expect(resolveIcon("auto-invert https://example.com/black.svg")).toEqual({
			src: "https://example.com/black.svg",
			autoInvert: true,
		});
		expect(resolveIcon("auto-invert sh:glance-dark").src).toBe(
			"https://cdn.jsdelivr.net/gh/selfhst/icons/svg/glance-dark.svg",
		);
	});

	it("paints a resolved shorthand in the img, inverted", () => {
		const { container } = render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{ links: [{ title: "Grafana", url: "https://grafana.lab", icon: "si:grafana" }] },
					],
				}}
			/>,
		);
		const img = container.querySelector(`.${styles.icon}`) as HTMLImageElement;
		expect(img.getAttribute("src")).toBe(
			"https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/grafana.svg",
		);
		expect(img.className).toContain(styles.iconAutoInvert);
	});

	it("drops the whole tile when the image fails to load", () => {
		const { container } = render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{
							links: [
								{
									title: "Grafana",
									url: "https://grafana.lab",
									icon: "https://example.com/missing.png",
								},
							],
						},
					],
				}}
			/>,
		);
		expect(container.querySelector(`.${styles.iconContainer}`)).not.toBeNull();
		fireEvent.error(container.querySelector(`.${styles.icon}`)!);
		// the tile goes, not just the img: an empty bordered box reads as a
		// missing image just as well as the glyph did
		expect(container.querySelector(`.${styles.iconContainer}`)).toBeNull();
		expect(screen.getByRole("link", { name: "Grafana" })).toBeInTheDocument();
	});

	it("maps a named group colour onto an accent class, not an inline colour", () => {
		const { container } = render(
			<Bookmarks
				data={null}
				config={{ type: "bookmarks", groups: [{ title: "Dev", color: "cyan", links: [] }] }}
			/>,
		);
		// the accent rides on the group, so the link arrows inherit it too
		const group = container.querySelector(`.${styles.group}`)!;
		expect(group.className).toContain(styles.titleAccentCyan);
		expect((group as HTMLElement).style.color).toBe("");
		expect(screen.getByText("Dev")).toBeInTheDocument();
	});

	it("rejects a free-form group colour, so a title can never be painted purple", () => {
		const group = { title: "Dev", links: [] };
		expect(
			bookmarksSchema.safeParse({ type: "bookmarks", groups: [{ ...group, color: "cyan" }] })
				.success,
		).toBe(true);
		expect(
			bookmarksSchema.safeParse({ type: "bookmarks", groups: [{ ...group, color: "purple" }] })
				.success,
		).toBe(false);
		expect(
			bookmarksSchema.safeParse({ type: "bookmarks", groups: [{ ...group, color: "#BD93F9" }] })
				.success,
		).toBe(false);
	});

	it("shows the arrow by default and drops it for hide-arrow, group or link", () => {
		render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{
							title: "Plain",
							links: [{ title: "A", url: "https://a.example" }],
						},
						{
							title: "Grouped",
							"hide-arrow": true,
							links: [
								{ title: "B", url: "https://b.example" },
								{ title: "C", url: "https://c.example", "hide-arrow": false },
							],
						},
					],
				}}
			/>,
		);
		const shown = (name: string) =>
			screen.getByRole("link", { name }).closest("li")!.textContent?.includes("↗");
		expect(shown("A")).toBe(true);
		expect(shown("B")).toBe(false);
		// a link overrides its group, in both directions
		expect(shown("C")).toBe(true);
	});

	it("lets target override same-tab, and the group fill in for its links", () => {
		render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{
							title: "Dev",
							"same-tab": true,
							links: [
								{ title: "Inherits", url: "https://a.example" },
								{ title: "Own target", url: "https://b.example", target: "_parent" },
								{ title: "Own tab", url: "https://c.example", "same-tab": false },
							],
						},
					],
				}}
			/>,
		);
		const target = (name: string) => screen.getByRole("link", { name }).getAttribute("target");
		expect(target("Inherits")).toBeNull();
		// target wins over the group's same-tab: true
		expect(target("Own target")).toBe("_parent");
		expect(target("Own tab")).toBe("_blank");
	});

	it("applies a group target to its links, the way glance does", () => {
		render(
			<Bookmarks
				data={null}
				config={{
					type: "bookmarks",
					groups: [
						{ title: "Dev", target: "_top", links: [{ title: "A", url: "https://a.example" }] },
					],
				}}
			/>,
		);
		expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("target", "_top");
	});

	it("shows an empty message when no groups are configured", () => {
		render(<Bookmarks data={null} config={{ type: "bookmarks" }} />);
		expect(screen.getByText("No bookmark groups configured.")).toBeInTheDocument();
	});

	// astryx's Link nests everything it renders in one span, which is why the
	// row used to need `.linkCard > span { display: contents !important; }` to
	// put the icon and title back side by side. ListItem lays the row out
	// itself, so that un-wrapping hack must never come back.
	it("needs no wrapper-flattening hack: the item lays the row out itself", () => {
		const css = readFileSync("src/client/widgets/bookmarks/bookmarks.module.css", "utf8");
		expect(css).not.toMatch(/display:\s*contents/);
		expect(css).not.toMatch(/!important/);
	});
});
