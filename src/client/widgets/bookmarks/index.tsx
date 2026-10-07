import { ListItem } from "@astryxdesign/core";
import { useState } from "react";
import type { BookmarksConfig } from "../../../shared/widgets/bookmarks";
import { resolveIcon } from "../../../shared/widgets/icon";
import { WidgetChrome } from "../../components/WidgetChrome";
import { type TagAccent, tagAccent } from "../feed/tag-accent";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./bookmarks.module.css";

const ICON_ACCENT_CLASS: Record<TagAccent, string> = {
	green: styles.iconAccentGreen,
	cyan: styles.iconAccentCyan,
	pink: styles.iconAccentPink,
	orange: styles.iconAccentOrange,
};

// The schema admits only these five names, so the mapping is total.
const TITLE_ACCENT_CLASS: Record<
	NonNullable<BookmarksConfig["groups"][number]["color"]>,
	string
> = {
	green: styles.titleAccentGreen,
	cyan: styles.titleAccentCyan,
	yellow: styles.titleAccentYellow,
	orange: styles.titleAccentOrange,
	pink: styles.titleAccentPink,
};

/** glance widget-bookmarks.go:44-66 — a link overrides its group, and
 * `target` overrides `same-tab` (which is why the two are resolved apart).
 * Glimpse adds a widget-wide `same-tab` at the lowest precedence. */
interface LinkProps {
	target: string | undefined;
	hideArrow: boolean;
}

function resolveLink(
	link: NonNullable<BookmarksConfig["groups"][number]["links"]>[number],
	group: NonNullable<BookmarksConfig["groups"][number]>,
	widgetSameTab: boolean | undefined,
): LinkProps {
	const sameTab = link["same-tab"] ?? group["same-tab"] ?? widgetSameTab ?? false;
	return {
		target: link.target || group.target || (sameTab ? undefined : "_blank"),
		hideArrow: link["hide-arrow"] ?? group["hide-arrow"] ?? false,
	};
}

// A bad or unreachable icon URL must cost the icon, not the row: the tile is
// dropped whole so the link keeps its text and the page never paints a
// broken-image glyph.
function BookmarkIcon({ icon, accent }: { icon: string; accent: TagAccent }) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	const { src, autoInvert } = resolveIcon(icon);
	return (
		<span className={`${styles.iconContainer} ${ICON_ACCENT_CLASS[accent]}`}>
			<img
				src={src}
				alt=""
				loading="lazy"
				onError={() => setFailed(true)}
				className={autoInvert ? `${styles.icon} ${styles.iconAutoInvert}` : styles.icon}
			/>
		</span>
	);
}
function Bookmarks({ config }: WidgetComponentProps) {
	const cfg = config as unknown as BookmarksConfig;
	const groups = cfg.groups ?? [];
	if (groups.length === 0) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
			>
				<div className={styles.empty}>No bookmark groups configured.</div>
			</WidgetChrome>
		);
	}

	return (
		<WidgetChrome
			title={cfg.title}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
		>
			{groups.map((group) => {
				const links = group.links ?? [];
				return (
					<div
						key={`${group.title ?? ""}::${links[0]?.url ?? ""}::${links.length}`}
						// The accent rides on the group so the arrow picks it up too:
						// glance paints both from --bookmarks-group-color.
						className={`${styles.group} ${group.color ? TITLE_ACCENT_CLASS[group.color] : ""}`}
					>
						{group.title ? <div className={styles.groupTitle}>{group.title}</div> : null}
						<ul className={styles.links}>
							{links.map((link) => {
								const { target, hideArrow } = resolveLink(link, group, cfg["same-tab"]);
								return (
									<ListItem
										key={`${link.title}::${link.url}::${link.description ?? ""}`}
										href={link.url}
										target={target}
										startContent={
											link.icon ? (
												<BookmarkIcon icon={link.icon} accent={tagAccent(link.url)} />
											) : undefined
										}
										label={link.title}
										description={link.description ?? undefined}
										endContent={
											hideArrow ? undefined : (
												<span className={styles.arrow} aria-hidden="true">
													↗
												</span>
											)
										}
									/>
								);
							})}
						</ul>
					</div>
				);
			})}
		</WidgetChrome>
	);
}

registerWidgetComponent("bookmarks", Bookmarks);

export default Bookmarks;
