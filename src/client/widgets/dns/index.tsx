import { Text } from "@astryxdesign/core";
import { CHART_HUES } from "astryx-dracula/shared/chart-hues";
import { useState } from "react";
import type { DnsStatsConfig } from "../../../shared/widgets/dns";
import type { DnsStats } from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./dns.module.css";

function fmtApprox(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export function DnsStatsWidget({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as DnsStatsConfig;
	const d = data as DnsStats | null;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	// Above the early returns: a tap pins a bar's readout, and on touch there is
	// neither :hover nor :focus-visible, so without this third channel the
	// per-bar values exist only for a device that has neither.
	const [pinned, setPinned] = useState<number | null>(null);

	if (loading) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				isLoading
			/>
		);
	}

	if (error) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				error={error}
				showErrors={cfg["show-errors"]}
			/>
		);
	}

	if (!d) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
			>
				<div className={styles.empty}>No data</div>
			</WidgetChrome>
		);
	}

	const showGraph = !cfg["hide-graph"] && d.series.length > 0;
	const showTop = !cfg["hide-top-domains"] && d.topBlockedDomains.length > 0;

	return (
		<WidgetChrome
			title={cfg.title}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
		>
			<div data-testid="dns-root">
				<div className={styles.totals}>
					<div className={styles.totalsItem}>
						<Text as="div" type="large" hasTabularNumbers data-testid="dns-total">
							{d.totalQueries.toLocaleString()}
						</Text>
						<Text as="div" type="label" className={styles.totalsLabel}>
							QUERIES
						</Text>
					</div>
					<div className={styles.totalsItem}>
						<Text as="div" type="large" hasTabularNumbers data-testid="dns-blocked">
							{d.blockedPercent}%
						</Text>
						<Text as="div" type="label" className={styles.totalsLabel}>
							BLOCKED
						</Text>
					</div>
					{d.responseTime > 0 ? (
						<div className={styles.totalsItem}>
							<Text as="div" type="large" hasTabularNumbers data-testid="dns-latency">
								{d.responseTime.toLocaleString()}ms
							</Text>
							<Text as="div" type="label" className={styles.totalsLabel}>
								LATENCY
							</Text>
						</div>
					) : (
						<div
							className={styles.totalsItem}
							title="Total number of blocked domains from all adlists"
						>
							<Text as="div" type="large" hasTabularNumbers data-testid="dns-domains">
								{fmtApprox(d.domainsBlocked)}
							</Text>
							<Text as="div" type="label" className={styles.totalsLabel}>
								DOMAINS
							</Text>
						</div>
					)}
				</div>

				{showGraph ? (
					<div className={styles.graph} data-testid="dns-graph">
						<div className={styles.gridlinesContainer} aria-hidden>
							<svg
								className={styles.gridlines}
								shapeRendering="crispEdges"
								viewBox="0 0 1 100"
								preserveAspectRatio="none"
								aria-hidden="true"
							>
								<g stroke="var(--color-graph-gridlines)" strokeWidth="1">
									<line x1="0" y1="1" x2="1" y2="1" vectorEffect="non-scaling-stroke" />
									<line x1="0" y1="25" x2="1" y2="25" vectorEffect="non-scaling-stroke" />
									<line x1="0" y1="50" x2="1" y2="50" vectorEffect="non-scaling-stroke" />
									<line x1="0" y1="75" x2="1" y2="75" vectorEffect="non-scaling-stroke" />
									<line
										x1="0"
										y1="99"
										x2="1"
										y2="99"
										vectorEffect="non-scaling-stroke"
										stroke="var(--color-progress-border)"
									/>
								</g>
							</svg>
						</div>
						<section className={styles.columns} aria-label="DNS queries and blocked share, by hour">
							{d.series.map((pt, idx) => (
								<button
									key={`dns-${pt.queries}-${pt.blocked}-${pt.percentBlocked}-${pt.percentTotal}`}
									type="button"
									className={styles.column}
									data-testid="dns-column"
									data-active={pinned === idx || undefined}
									aria-label={`${d.timeLabels[idx] ?? `Hour ${idx + 1}`}: ${pt.queries.toLocaleString()} queries, ${pt.percentBlocked}% blocked`}
									onClick={() => setPinned((cur) => (cur === idx ? null : idx))}
									onBlur={() => setPinned((cur) => (cur === idx ? null : cur))}
									onKeyDown={(e) => {
										if (e.key === "Escape") setPinned(null);
									}}
								>
									<div className={styles.tip} data-testid="dns-tip" aria-hidden="true">
										<div>
											<Text as="div" type="large" hasTabularNumbers>
												{pt.queries.toLocaleString()}
											</Text>
											<Text as="div" type="label">
												QUERIES
											</Text>
										</div>
										<div>
											<Text as="div" type="large" hasTabularNumbers>
												{pt.percentBlocked}%
											</Text>
											<Text as="div" type="label">
												BLOCKED
											</Text>
										</div>
									</div>
									{pt.percentTotal > 0 ? (
										<div
											className={styles.bar}
											style={{ "--bar-height": String(pt.percentTotal) } as React.CSSProperties}
											data-testid="dns-bar"
										>
											{pt.queries !== pt.blocked ? (
												<div
													className={styles.queries}
													style={{ "--bar-hue": CHART_HUES.cyan } as React.CSSProperties}
												/>
											) : null}
											{pt.percentBlocked > 0 ? (
												<div
													className={styles.blocked}
													style={
														{
															"--percent": `${pt.percentBlocked}%`,
															"--bar-hue": CHART_HUES.orange,
														} as React.CSSProperties
													}
												/>
											) : null}
										</div>
									) : null}
									<div className={styles.time} data-testid="dns-time">
										{d.timeLabels[idx] ?? ""}
									</div>
								</button>
							))}
						</section>
					</div>
				) : null}

				{showTop ? (
					<details
						className={`${styles.details} ${showGraph ? styles.detailsWithGraph : ""}`}
						data-testid="dns-details"
					>
						<summary className={styles.summary}>
							<Text type="supporting" className={styles.summaryText}>
								Top blocked domains
							</Text>
						</summary>
						<ul className={styles.list}>
							{d.topBlockedDomains.map((t) => (
								<li key={t.domain} className={styles.row} data-testid="dns-domain-row">
									<div className={styles.domain} title={t.domain}>
										<Text type="supporting">{t.domain}</Text>
									</div>
									<Text
										type="supporting"
										justify="end"
										hasTabularNumbers
										className={styles.percent}
									>
										<Text color="primary">{t.percentBlocked}</Text>%
									</Text>
								</li>
							))}
						</ul>
					</details>
				) : null}
			</div>
		</WidgetChrome>
	);
}

registerWidgetComponent("dns-stats", DnsStatsWidget);
export default DnsStatsWidget;
