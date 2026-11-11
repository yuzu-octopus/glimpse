import { Badge, Stack, StatusDot, type StatusDotVariant, Text } from "@astryxdesign/core";
import type {
	RexBlockState,
	RexSessionBlock,
	RexSessionsData,
} from "../../../shared/widgets/payloads";
import type { RexSessionsConfig } from "../../../shared/widgets/rex-sessions";
import { WidgetChrome } from "../../components/WidgetChrome";
import { useAge } from "../_hooks/useAge";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./rex-sessions.module.css";

/** done reads as settled, working as live, failed as negative, blocked as
 * the "needs you" attention state. `warning` is the theme's yellow — the
 * house status row for attention — and `info` is cyan, so blocked never
 * borrows purple (tappable-only) or red (genuinely broken). */
const DOT_VARIANT: Record<RexBlockState, StatusDotVariant> = {
	done: "success",
	working: "info",
	blocked: "warning",
	failed: "error",
	unknown: "neutral",
};

function BlockAge({ iso }: { iso: string | null }) {
	const age = useAge(iso);
	if (!age) return null;
	return (
		<Text type="supporting" maxLines={1} data-testid="rex-age">
			{age} ago
		</Text>
	);
}

function BlockRow({ block }: { block: RexSessionBlock }) {
	const headline = block.title ?? block.process ?? block.blockLabel;
	return (
		<Stack direction="horizontal" gap={3} vAlign="center" className={styles.row}>
			<StatusDot
				variant={DOT_VARIANT[block.state]}
				label={block.state}
				isPulsing={block.state === "working"}
				data-testid={`rex-dot-${block.state}`}
			/>
			<Stack gap={0.5} className={styles.body}>
				<Stack direction="horizontal" gap={2} vAlign="center">
					<Text maxLines={1}>{headline}</Text>
					{block.focused ? (
						<Badge variant="cyan" label="focused" data-testid="rex-focused" />
					) : null}
				</Stack>
				<Stack direction="horizontal" gap={2} vAlign="center">
					<Text type="supporting" maxLines={1} data-testid="rex-crumb">
						{block.sessionLabel} · {block.windowLabel}
					</Text>
					{block.pwd ? (
						<Text type="supporting" maxLines={1} data-testid="rex-pwd">
							{block.pwd}
						</Text>
					) : null}
					<BlockAge iso={block.updatedAt} />
				</Stack>
			</Stack>
		</Stack>
	);
}

function RexSessions({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as RexSessionsConfig;
	const payload = (data ?? { blocks: [] }) as RexSessionsData;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	const empty = !loading && !error && payload.blocks.length === 0;
	return (
		<WidgetChrome
			title={cfg.title ?? "Rex sessions"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			error={error}
			showErrors={cfg["show-errors"]}
			isLoading={loading}
			collapseAfter={10}
			items={
				empty
					? undefined
					: payload.blocks.map((b) => <BlockRow key={`${b.sessionId}::${b.blockId}`} block={b} />)
			}
		>
			{empty ? <Text type="supporting">No rex sessions running.</Text> : null}
		</WidgetChrome>
	);
}

registerWidgetComponent("rex-sessions", RexSessions);

export default RexSessions;
