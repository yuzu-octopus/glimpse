import {
	Banner,
	Button,
	Card,
	Heading,
	Link,
	Skeleton,
	Stack,
	StatusDot,
} from "@astryxdesign/core";
import { ChevronRight } from "lucide-react";
import { createContext, memo, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import styles from "./widget-chrome.module.css";

/** Page-level hide-headers flag. PageView provides it; WidgetChrome consumes it. */
// eslint-disable-next-line react-doctor/only-export-components -- context lives with its sole consumer by design (ponytail cut: HideHeadersContext.tsx inlined here)
export const HideHeadersContext = createContext(false);

interface WidgetChromeProps {
	title?: string;
	titleUrl?: string;
	hideHeader?: boolean;
	cssClass?: string;
	isLoading?: boolean;
	error?: string;
	/** false → quiet failure: the chrome and whatever content it still has stay,
	 * no error Banner. The StatusDot beside the title keeps reporting the
	 * failure, so quiet never means invisible. Defaults true. */
	showErrors?: boolean;
	skeletonShape?: "list" | "stat" | "chart" | "rows";
	/** When set (>= 0), lists longer than this collapse behind a "Show more"
	 * toggle. -1 (glance semantics) — or any negative — never collapses. */
	collapseAfter?: number;
	/** List rows (collapse-aware). When absent, `children` renders as-is. */
	items?: ReactNode[];
	/** Rendered above the body, outside the scroll rail or grid the body may be.
	 * For per-item status a widget still wants on screen — a dead source among
	 * live ones. Nothing renders when absent, so a healthy widget is untouched. */
	notice?: ReactNode;
	children?: ReactNode;
}

type SkeletonShape = NonNullable<WidgetChromeProps["skeletonShape"]>;

/** One lookup instead of a ternary chain: the shape picks the class, the
 *  branch that fills the shape lives in <ChromeSkeleton>. */
const SHAPE_CLASS: Record<SkeletonShape, string> = {
	list: styles.shapeList,
	stat: styles.shapeStat,
	chart: styles.shapeChart,
	rows: styles.shapeRows,
};

/** glance semantics: only a non-negative `collapseAfter` truncates, and only
 *  when there is actually something hidden behind the toggle. */
function canCollapse(collapseAfter: number | undefined, total: number): boolean {
	return typeof collapseAfter === "number" && collapseAfter >= 0 && total > collapseAfter;
}

/** Purple = tappable: only a linked title wears the accent. Status goes to
 *  StatusDot, not a hand-rolled box: the kit owns the shape, the accessible
 *  name, and the hover explanation. */
function ChromeHeader({
	title,
	titleUrl,
	error,
	loud,
}: {
	title: string;
	titleUrl?: string;
	error?: string;
	loud: boolean;
}) {
	const failLabel = title ? `${title} failed to load` : "This widget failed to load";
	return (
		<div className={loud ? `${styles.header} ${styles.errorHeader}` : styles.header}>
			<Stack direction="horizontal" vAlign="center" gap={1.5} className={styles.titleRow}>
				{titleUrl ? (
					<Heading level={3} className={`${styles.title} ${styles.titleLink}`}>
						<Link href={titleUrl} hasUnderline={false}>
							{title}
						</Link>
					</Heading>
				) : (
					<Heading level={3} className={styles.title}>
						{title}
					</Heading>
				)}
				{error ? (
					<StatusDot
						variant="error"
						label={failLabel}
						tooltip={failLabel}
						data-testid="widget-error-dot"
					/>
				) : null}
			</Stack>
		</div>
	);
}

/** The four skeleton fills, one per declared shape — the shape is data, not
 *  a nest of ternaries inside the chrome's render. */
function ChromeSkeleton({ shape }: { shape: SkeletonShape }) {
	return (
		<div className={`${styles.skeleton} ${SHAPE_CLASS[shape]}`} data-testid="widget-loading">
			{shape === "list" ? (
				Array.from({ length: 5 }, (_, i) => (
					<Stack key={i} direction="horizontal" vAlign="center" gap={2}>
						<Skeleton width={24} height={24} radius="rounded" />
						<Stack direction="vertical" gap={1.5} className={styles.listLines}>
							<Skeleton width="70%" height={12} />
							<Skeleton width="45%" height={10} />
						</Stack>
					</Stack>
				))
			) : shape === "stat" ? (
				<>
					<Skeleton width="100%" height={48} />
					<Skeleton width="40%" height={12} />
				</>
			) : shape === "chart" ? (
				<Skeleton width="100%" height={120} />
			) : (
				<>
					<Skeleton width="100%" height={14} />
					<Skeleton width="92%" height={14} />
					<Skeleton width="97%" height={14} />
				</>
			)}
		</div>
	);
}

function ShowMoreButton({
	expanded,
	hiddenCount,
	onToggle,
}: {
	expanded: boolean;
	hiddenCount: number;
	onToggle: () => void;
}) {
	return (
		<Button
			variant="ghost"
			width="100%"
			className={styles.toggle}
			label={expanded ? "Show less" : `Show more (${hiddenCount})`}
			endContent={
				<ChevronRight
					size={12}
					className={expanded ? `${styles.chevron} ${styles.chevronExpanded}` : styles.chevron}
				/>
			}
			onClick={onToggle}
		/>
	);
}

/** Shared card chrome for every widget: header, loading, error, collapse.
 * Memo'd — polls that leave a widget's props untouched skip re-render. */
export const WidgetChrome = memo(function WidgetChrome({
	title,
	titleUrl,
	hideHeader,
	cssClass,
	isLoading,
	error,
	showErrors,
	skeletonShape,
	collapseAfter,
	items,
	notice,
	children,
}: WidgetChromeProps) {
	const shape = skeletonShape ?? "rows";
	const globalHide = useContext(HideHeadersContext);
	const effectiveHide = hideHeader || globalHide;
	const [expanded, setExpanded] = useState(false);
	const cardRef = useRef<HTMLDivElement>(null);
	const list = useMemo(
		() => items ?? (children === undefined ? [] : [children]),
		[items, children],
	);
	// `show-errors: false` mutes the widget: no Banner, no error text, no red
	// header wash. The status dot beside the title is the whole report.
	const loud = Boolean(error) && showErrors !== false;
	const n = collapseAfter ?? 0;
	const has = canCollapse(collapseAfter, list.length);
	// Stable slice identity across renders so the memo wrapper (and row
	// reconcilers downstream) isn't defeated by a fresh array each pass.
	const visible = useMemo(
		() => (has && !expanded ? list.slice(0, n) : list),
		[has, expanded, list, n],
	);

	// One handler for the two-way toggle: expanding is a plain state flip,
	// collapsing also brings the card back into view — jsdom lacks
	// scrollIntoView, hence the ?.
	const toggle = () => {
		if (!expanded) {
			setExpanded(true);
			return;
		}
		setExpanded(false);
		cardRef.current?.scrollIntoView?.({ block: "nearest" });
	};

	return (
		<div className={styles.widget}>
			{!effectiveHide && title ? (
				<ChromeHeader title={title} titleUrl={titleUrl} error={error} loud={loud} />
			) : null}
			<Card ref={cardRef} className={cssClass} padding={4}>
				{/* The notice sits outside the body: a body its widget turned into a
            grid or a horizontal rail must not absorb a status row as one more
            cell. A widget-level error owns the whole body, so the notice
            stands down rather than competing with the Banner. */}
				{notice && !loud ? <div className={styles.notice}>{notice}</div> : null}
				{/* The body IS the layout container for widgets that style it (the
				    videos rail/grid reads `[data-testid="widget-body"]`), so nothing
				    may be wrapped between it and its children. The reveal animation
				    and its replay key ride on this element instead. */}
				<div
					className={`${styles.body} ${styles.bodyReveal}`}
					data-testid="widget-body"
					key={bodyKey(isLoading, loud, has, expanded)}
				>
					<WidgetBody
						isLoading={isLoading}
						loud={loud}
						error={error}
						shape={shape}
						visible={visible}
						has={has}
						expanded={expanded}
						hiddenCount={list.length - n}
						onToggle={toggle}
					/>
				</div>
			</Card>
		</div>
	);
});

/** Replay key for the body's reveal: a state change (loading -> content, a
 *  failure surfacing, Show more/less) remounts the body so the animation runs
 *  again. A static body keeps one key so it never re-animates on a data
 *  refresh — the stream replaces widget payloads constantly, and re-fading the
 *  whole card on every chunk would read as a flicker. */
function bodyKey(
	isLoading: boolean | undefined,
	loud: boolean,
	has: boolean,
	expanded: boolean,
): string {
	if (isLoading) return "loading";
	if (loud) return "error";
	return has ? `list-${expanded}` : "static";
}

/** The body's three states — loading, failed, content — as one small unit, so
 *  WidgetChrome's own render stays a two-branch layout rather than a chain.
 *  Returns the body's *children* only: the body element is the layout
 *  container widgets style (the videos rail/grid reads it), so this must never
 *  add a wrapper around them. */
function WidgetBody({
	isLoading,
	loud,
	error,
	shape,
	visible,
	has,
	expanded,
	hiddenCount,
	onToggle,
}: {
	isLoading?: boolean;
	loud: boolean;
	error?: string;
	shape: SkeletonShape;
	visible: ReactNode[];
	has: boolean;
	expanded: boolean;
	hiddenCount: number;
	onToggle: () => void;
}) {
	if (isLoading) return <ChromeSkeleton shape={shape} />;
	if (loud) return <Banner status="error" title={error} />;
	return (
		<>
			{visible}
			{has ? (
				<ShowMoreButton expanded={expanded} hiddenCount={hiddenCount} onToggle={onToggle} />
			) : null}
		</>
	);
}
