import { Badge, type BadgeVariant, Link, Text } from "@astryxdesign/core";
import type { ModelReleasesConfig } from "../../../shared/widgets/model-releases";
import type { ModelReleaseItem, ModelReleasesData } from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { useAge } from "../_hooks/useAge";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./model-releases.module.css";

function labBadgeVariant(author: string): BadgeVariant {
	const a = author.toLowerCase();
	if (a.includes("openai")) return "cyan";
	if (a.includes("anthropic")) return "orange";
	if (a.includes("meta")) return "purple";
	if (a.includes("google") || a.includes("deepmind")) return "blue";
	if (a.includes("mistral")) return "yellow";
	if (a.includes("xai") || a.includes("grok")) return "red";
	if (a.includes("hugging")) return "yellow";
	return "green";
}

function ReleaseRow({ item, compact }: { item: ModelReleaseItem; compact: boolean }) {
	const age = useAge(item.publishedAt);
	const variant = labBadgeVariant(item.author);

	return (
		<li className={styles.row}>
			<div className={styles.header}>
				<Badge variant={variant} label={item.author} className={styles.authorBadge} />
				<div className={styles.modelLink}>
					<Link href={item.url} target="_blank" weight="semibold" hasUnderline={false} maxLines={1}>
						{item.model}
					</Link>
				</div>
				{age ? <span className={styles.time}>{age}</span> : null}
			</div>
			{!compact && item.description ? (
				<Text type="supporting" as="div" maxLines={2} className={styles.description}>
					{item.description}
				</Text>
			) : null}
		</li>
	);
}

function ModelReleases({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as ModelReleasesConfig;
	const payload = data as ModelReleasesData | null;
	const items = payload?.items ?? [];
	const compact = cfg.style === "compact";

	return (
		<WidgetChrome
			title={cfg.title ?? "Model Releases"}
			titleUrl={cfg["title-url"] ?? "https://live.aitracker.bot"}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			isLoading={isLoading}
			error={error}
			showErrors={cfg["show-errors"]}
		>
			{items.length === 0 && !isLoading ? (
				<div className={styles.empty}>No recent model releases</div>
			) : (
				<ul className={styles.list}>
					{items.map((item) => (
						<ReleaseRow key={item.id} item={item} compact={compact} />
					))}
				</ul>
			)}
		</WidgetChrome>
	);
}

registerWidgetComponent("model-releases", ModelReleases);

export default ModelReleases;
