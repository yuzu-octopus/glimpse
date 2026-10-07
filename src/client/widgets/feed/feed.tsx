import { Badge, type BadgeVariant, Grid, HStack, Link, Stack, Text } from "@astryxdesign/core";
import type { ReactNode } from "react";
import styles from "./feed.module.css";
import { type TagAccent, tagAccent } from "./tag-accent";

/**
 * Generic flat feed module — deep module, small interface.
 * One row per item, consistent flat glance styling:
 * - hover: the kit's overlay dim on the row, title -> primary
 * - meta subdued, tags take the accent hashed from the tag text, image thumbnail
 *
 * Callers map their domain payload to FeedItem; Feed owns layout/colour/hover.
 */
export interface FeedItem {
	title: string;
	url: string;
	/** single meta line — e.g. "example.com • 42 points • 1h" (already joined by caller) */
	meta?: string | null;
	/** optional secondary text (rss description, release notes preview, etc.) */
	description?: string | null;
	/** thumbnail/image url */
	image?: string | null;
	/** legacy single tag */
	tag?: string | null;
	/** multiple chips */
	tags?: string[] | null;
}

export type FeedLayout = "list" | "grid" | "row";

export interface FeedProps {
	items: FeedItem[];
	/** layout: list (vertical), grid (min 220 per column), row (horizontal scroll) */
	layout?: FeedLayout;
	/** when true titles truncate to one line; else they clamp to two (rss single-line-titles) */
	singleLine?: boolean;
	/** Rendered in place of the rows when `items` is empty. A feed that
	 * returned nothing must say so: an empty bordered card is indistinguishable
	 * from a widget that failed to render. */
	emptyText?: string;
}

/** Title clamp: two lines by default, one when the feed asks for single-line titles. */
const TITLE_LINES_DEFAULT = 2;
const TITLE_LINES_SINGLE = 1;
const DESCRIPTION_LINES = 2;

/** Used when a caller supplies no wording of its own. */
const DEFAULT_EMPTY_TEXT = "Nothing to show";

/** A tag is a Badge, and yellow is the tag hue — the default the cycle falls back to. */
const ACCENT_VARIANT: Record<TagAccent, BadgeVariant> = {
	green: "green",
	cyan: "cyan",
	pink: "pink",
	orange: "orange",
};

function chipsFor(item: FeedItem): string[] {
	if (item.tags && item.tags.length > 0) return item.tags;
	if (item.tag) return [item.tag];
	return [];
}

function Shell({ layout, children }: { layout: FeedLayout; children: ReactNode }) {
	if (layout === "grid")
		return (
			<Grid columns={{ minWidth: 220 }} gap={6}>
				{children}
			</Grid>
		);
	if (layout === "row")
		return (
			<HStack gap={6} className={styles.rail}>
				{children}
			</HStack>
		);
	return <Stack gap={0}>{children}</Stack>;
}

export function Feed({
	items,
	layout = "list",
	singleLine,
	emptyText = DEFAULT_EMPTY_TEXT,
}: FeedProps) {
	if (items.length === 0) return <div className={styles.empty}>{emptyText}</div>;
	return (
		<Shell layout={layout}>
			{items.map((item) => {
				const chips = chipsFor(item);
				const key = item.url || item.title;
				return (
					<div key={key} className={styles.item}>
						{item.image ? (
							<div className={styles.thumbWrap}>
								<img src={item.image} alt="" loading="lazy" className={styles.thumb} />
							</div>
						) : null}
						<Stack gap={0.5} className={styles.content}>
							<Link
								href={item.url}
								target="_blank"
								type="body"
								weight="medium"
								display="block"
								maxLines={singleLine ? TITLE_LINES_SINGLE : TITLE_LINES_DEFAULT}
								hasUnderline={false}
								className={styles.title}
							>
								{item.title}
							</Link>
							{item.meta ? (
								<Text type="supporting" as="div">
									{item.meta}
								</Text>
							) : null}
							{item.description ? (
								<Text type="body" as="div" maxLines={DESCRIPTION_LINES}>
									{item.description}
								</Text>
							) : null}
							{chips.length > 0 ? (
								<HStack gap={1.5} wrap="wrap" align="start">
									{chips.map((c) => (
										<Badge
											key={c}
											variant={ACCENT_VARIANT[tagAccent(c)]}
											label={c}
											className={styles.chip}
										/>
									))}
								</HStack>
							) : null}
						</Stack>
					</div>
				);
			})}
		</Shell>
	);
}

export default Feed;
