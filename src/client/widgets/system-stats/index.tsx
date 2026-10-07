import { Stack, Text } from "@astryxdesign/core";
import type { SystemStatsData } from "../../../shared/widgets/payloads";
import type { SystemStatsConfig } from "../../../shared/widgets/system-stats";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./system-stats.module.css";

function fmtBytes(b: number): string {
	if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`;
	if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
	if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
	return `${b} B`;
}

/** `percent` is the row's 0-100 load. A row without one (a GPU model with no
 *  temperature) gets no bar — a fabricated series would read as data. */
function Row({
	label,
	value,
	sub,
	percent,
}: {
	label: string;
	value: string;
	sub?: string;
	percent?: number | null;
}) {
	const p = percent == null ? null : Math.max(0, Math.min(100, Math.round(percent)));
	return (
		<Stack gap={1.5} className={styles.row}>
			{/* Fixed label / flexible value / right-hugging sub. Three equal tracks
          (the old `columns={3}`) centred a short value and truncated a long
          one; a table-shaped grid keeps every row on the same rules. */}
			<div className={styles.rowGrid}>
				<Text type="label">{label}</Text>
				<Text hasTabularNumbers maxLines={1} className={styles.value}>
					{value}
				</Text>
				{sub ? (
					<Text
						type="supporting"
						hasTabularNumbers
						maxLines={1}
						justify="end"
						className={styles.sub}
					>
						{sub}
					</Text>
				) : null}
			</div>
			{p === null ? null : (
				// Data ink — one series, so one hue: a neutral track with a single fill
				// that escalates by severity. A label + a number reads the same at 95%
				// as at 5%; the bar is what makes the difference legible at a glance.
				<meter
					className={styles.meter}
					data-high={p >= 85 || undefined}
					data-critical={p >= 95 || undefined}
					style={{ "--progress": `${p}%` } as React.CSSProperties}
					min={0}
					max={100}
					value={p}
					aria-valuenow={p}
					aria-label={`${label} load`}
				/>
			)}
		</Stack>
	);
}

/** One pass over a live homelab reading produces the row list, in display
 *  order, with the same keys the chrome reconciles by. Kept out of the
 *  component so the component only chooses a chrome state. `cpu` travels
 *  beside the payload because a null one is the "not on homelab host" case
 *  the caller already screened out. */
function buildRows(
	d: SystemStatsData,
	cpu: NonNullable<SystemStatsData["cpu"]>,
): React.ReactNode[] {
	const rows: React.ReactNode[] = [];

	// CPU
	rows.push(
		<Row
			key="cpu"
			label="CPU"
			value={`${cpu.cores} cores${cpu.speed ? ` @ ${cpu.speed} GHz` : ""}`}
			sub={cpu.load != null ? `${Math.round(cpu.load)}%` : undefined}
			percent={cpu.load}
		/>,
	);

	// MEM
	if (d.mem) {
		const pct = d.mem.total ? Math.round((d.mem.used / d.mem.total) * 100) : 0;
		rows.push(
			<Row
				key="mem"
				label="MEM"
				value={`${fmtBytes(d.mem.used)} / ${fmtBytes(d.mem.total)}`}
				sub={`${pct}%`}
				percent={pct}
			/>,
		);
	}

	// FS
	for (const f of d.fs) {
		rows.push(
			<Row
				key={`fs-${f.mount}`}
				label="DISK"
				value={f.mount}
				sub={`${fmtBytes(f.used)} / ${fmtBytes(f.size)}`}
				percent={f.use}
			/>,
		);
	}

	// TEMP
	if (d.temp != null) {
		rows.push(<Row key="temp" label="TEMP" value={`${d.temp}°C`} percent={d.temp} />);
	}

	// GPU
	for (const g of d.gpu) {
		rows.push(
			<Row
				key={`gpu-${g.model}-${g.temp ?? "na"}`}
				label="GPU"
				value={g.model}
				sub={g.temp != null ? `${g.temp}°C` : undefined}
				percent={g.temp}
			/>,
		);
	}

	// BATTERY
	if (d.battery) {
		const b = d.battery;
		rows.push(
			<Row
				key="battery"
				label="BATTERY"
				value={`${b.percent}% ${b.status}`}
				sub={b.hoursRemaining != null ? `${b.hoursRemaining}h remaining` : undefined}
				percent={b.percent}
			/>,
		);
	}

	// UPTIME
	if (d.uptimeHrs != null) {
		rows.push(<Row key="uptime" label="UPTIME" value={`${d.uptimeHrs}h`} />);
	}

	// LOAD
	if (d.load1m != null) {
		rows.push(<Row key="load" label="LOAD" value={d.load1m.toFixed(2)} />);
	}

	// FAN
	if (d.fanRpm != null) {
		rows.push(<Row key="fan" label="FAN" value={`${d.fanRpm} RPM`} />);
	}

	// GPU LOAD
	if (d.gpuLoad != null) {
		rows.push(<Row key="gpuLoad" label="GPU LOAD" value={`${d.gpuLoad}%`} percent={d.gpuLoad} />);
	}

	return rows;
}

export function SystemStats({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as SystemStatsConfig;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	const d = data as SystemStatsData | null;

	if (loading) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				isLoading
				error={error}
				showErrors={cfg["show-errors"]}
			/>
		);
	}

	// Graceful placeholder when not on homelab host (cpu null)
	if (!d || d.cpu === null) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				error={error}
				showErrors={cfg["show-errors"]}
			>
				<Text type="supporting">No data — not running on homelab host</Text>
			</WidgetChrome>
		);
	}

	const rows = buildRows(d, d.cpu);

	return (
		<WidgetChrome
			title={cfg.title}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			error={error}
			showErrors={cfg["show-errors"]}
			items={rows}
		/>
	);
}

registerWidgetComponent("system-stats", SystemStats);

export default SystemStats;
