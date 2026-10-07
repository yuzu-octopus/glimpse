import { Stack, StatusDot, type StatusDotVariant, Text } from "@astryxdesign/core";
import type { HomeAssistantConfig } from "../../../shared/widgets/home-assistant";
import type {
	HomeAssistantData,
	HomeAssistantEntity,
	HomeAssistantStatus,
} from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./home-assistant.module.css";

/** One vocabulary for the dot: green for the state you want, red only for a
 *  genuinely negative one (an open door, an unlocked lock), muted for the
 *  plain inactive state — a light that is off is not a problem. */
const STATUS_VARIANT: Record<HomeAssistantStatus, StatusDotVariant> = {
	positive: "success",
	negative: "error",
	neutral: "neutral",
};

function EntityRow({ entity }: { entity: HomeAssistantEntity }) {
	return (
		<Stack direction="horizontal" gap={3} vAlign="center" className={styles.row}>
			<StatusDot
				variant={STATUS_VARIANT[entity.status]}
				label={`${entity.name} ${entity.value}`}
				data-testid={`ha-status-${entity.status}`}
			/>
			<Stack gap={0.5} className={styles.body}>
				<Text maxLines={1}>{entity.name}</Text>
				<Text type="supporting" maxLines={1} className={styles.id}>
					{entity.id}
				</Text>
			</Stack>
			<Text
				className={styles.value}
				hasTabularNumbers={entity.numeric}
				maxLines={1}
				data-testid="ha-value"
			>
				{entity.value}
			</Text>
		</Stack>
	);
}

function HomeAssistant({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as HomeAssistantConfig;
	const payload = (data ?? { entities: [] }) as HomeAssistantData;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	return (
		<WidgetChrome
			title={cfg.title ?? "Home"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			error={error}
			showErrors={cfg["show-errors"]}
			isLoading={loading}
			collapseAfter={10}
			items={payload.entities.map((e) => <EntityRow key={e.id} entity={e} />)}
		/>
	);
}

registerWidgetComponent("home-assistant", HomeAssistant);

export default HomeAssistant;
