import type { TableColumn } from "@astryxdesign/core";
import {
	HStack,
	Link,
	pixel,
	proportional,
	Stack,
	StatusDot,
	Table,
	Text,
	VisuallyHidden,
} from "@astryxdesign/core";
import type { ModelEndpointsConfig } from "../../../shared/widgets/model-endpoints";
import type {
	EndpointHealth,
	ModelEndpointRow,
	ModelEndpointsData,
} from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./model-endpoints.module.css";

/** Status colours are semantic, so the dot carries them, never a cell fill.
 * `unknown` is neutral: no sample is not a failure. */
const DOT_VARIANT = {
	up: "success",
	degraded: "warning",
	down: "error",
	unknown: "neutral",
} as const;

const HEALTH_LABEL: Record<EndpointHealth, string> = {
	up: "up",
	degraded: "degraded",
	down: "down",
	unknown: "unknown",
};

/** A row plus the one presentation fact the cell renderer cannot see. */
type Row = ModelEndpointRow & { head: boolean };

/**
 * One model block instead of one link per row. The server hands rows over in
 * worst-first order, so gathering a model's rows into the position of its
 * first (worst) row keeps the least healthy model at the top while printing
 * its slug once.
 */
function groupByModel(rows: ModelEndpointRow[]): Row[] {
	const byModel = new Map<string, ModelEndpointRow[]>();
	for (const row of rows) {
		const block = byModel.get(row.model);
		if (block) block.push(row);
		else byModel.set(row.model, [row]);
	}
	return [...byModel.values()].flatMap((block) =>
		block.map((row, i) => ({ ...row, head: i === 0 })),
	);
}

function uptime(value: number | null): string {
	if (value === null) return "—";
	// One decimal: 0.1% is finer than the upstream resolves, and five
	// characters is what the column holds before it truncates to "100.…".
	return value.toFixed(1);
}

const COLUMNS: TableColumn<Row>[] = [
	{
		key: "model",
		header: "Model",
		width: proportional(2, { minWidth: 150 }),
		renderCell: (row) => (
			<HStack gap={2} vAlign="center" className={styles.modelCell}>
				<StatusDot
					variant={DOT_VARIANT[row.health]}
					label={HEALTH_LABEL[row.health]}
					tooltip={
						row.status === null
							? "OpenRouter reported no routing status for this endpoint"
							: `OpenRouter endpoint status ${row.status}`
					}
				/>
				{row.head ? (
					// Purple is reserved for things you can click: the model id is the
					// only tappable element, printed once per block.
					<Link
						href={row.url}
						target="_blank"
						isExternalLink
						type="code"
						maxLines={1}
						className={styles.model}
					>
						{row.model}
					</Link>
				) : (
					// A continuation row stays quiet on screen but keeps its model in
					// the accessibility tree, so a row is never orphaned.
					<VisuallyHidden>{row.model}</VisuallyHidden>
				)}
			</HStack>
		),
	},
	{
		key: "provider",
		header: "Provider",
		width: proportional(1.4, { minWidth: 96 }),
		renderCell: (row) => (
			<Text type="supporting" maxLines={1}>
				{row.provider}
			</Text>
		),
	},
	{
		key: "uptime5m",
		header: "5m",
		width: pixel(62),
		renderCell: (row) => (
			<Text type="supporting" hasTabularNumbers justify="end">
				{uptime(row.uptime5m)}
			</Text>
		),
	},
	{
		key: "uptime30m",
		header: "30m",
		width: pixel(62),
		renderCell: (row) => (
			<Text type="supporting" hasTabularNumbers justify="end">
				{uptime(row.uptime30m)}
			</Text>
		),
	},
	{
		key: "uptime1d",
		header: "1d",
		width: pixel(62),
		renderCell: (row) => (
			<Text type="supporting" hasTabularNumbers justify="end">
				{uptime(row.uptime1d)}
			</Text>
		),
	},
];

function summary(payload: ModelEndpointsData): string {
	const endpoints = payload.models.reduce((n, m) => n + m.providers, 0);
	const down = payload.models.reduce((n, m) => n + m.down, 0);
	const degraded = payload.models.reduce((n, m) => n + m.degraded, 0);
	const parts = [`${payload.checked}/${payload.requested} models`, `${endpoints} providers`];
	if (degraded) parts.push(`${degraded} degraded`);
	if (down) parts.push(`${down} down`);
	if (payload.failed.length) parts.push(`${payload.failed.length} unreachable`);
	return parts.join(" · ");
}

/** `checked/requested models · N providers · …` with the overflow tail. */
function SummaryLine({ payload, hidden }: { payload: ModelEndpointsData; hidden: number }) {
	return (
		<Text type="supporting" maxLines={1}>
			{summary(payload)}
			{hidden > 0 ? ` · +${hidden} more` : ""}
		</Text>
	);
}

/** An unreachable model is not an empty result, and saying "no endpoints"
 *  when the request never landed would blame the provider for our own
 *  network. */
function EmptyNote({
	payload,
	unhealthyOnly,
}: {
	payload: ModelEndpointsData;
	unhealthyOnly?: boolean;
}) {
	return (
		<Text type="supporting">
			{payload.failed.length === payload.requested
				? "No models answered"
				: unhealthyOnly
					? "Every provider is up"
					: "No endpoints returned"}
		</Text>
	);
}

function EndpointTable({ rows }: { rows: Row[] }) {
	return (
		<Table
			data={rows}
			columns={COLUMNS}
			density="compact"
			dividers="rows"
			hasHover
			textOverflow="truncate"
		/>
	);
}

function ModelEndpoints({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as ModelEndpointsConfig;
	const payload = (data ?? null) as ModelEndpointsData | null;
	const loading = isLoading ?? (payload == null && !error);
	const rows = payload ? groupByModel(payload.rows) : [];
	const hidden = payload ? payload.total - payload.rows.length : 0;

	return (
		<WidgetChrome
			title={cfg.title ?? "Model endpoints"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			error={error}
			showErrors={cfg["show-errors"]}
			isLoading={loading}
		>
			<Stack gap={2} className={styles.body}>
				{payload ? <SummaryLine payload={payload} hidden={hidden} /> : null}

				{rows.length === 0 && !loading && payload ? (
					<EmptyNote payload={payload} unhealthyOnly={cfg["unhealthy-only"]} />
				) : null}

				{rows.length > 0 ? <EndpointTable rows={rows} /> : null}
			</Stack>
		</WidgetChrome>
	);
}

registerWidgetComponent("model-endpoints", ModelEndpoints);
export default ModelEndpoints;
