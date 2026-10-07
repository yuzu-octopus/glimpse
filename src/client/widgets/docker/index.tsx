import {
	Badge,
	type BadgeVariant,
	Button,
	Link,
	Stack,
	StatusDot,
	type StatusDotVariant,
	Text,
	Tooltip,
} from "@astryxdesign/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DockerContainersConfig } from "../../../shared/widgets/docker";
import type { DockerContainer, DockerData } from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./docker.module.css";

/** One vocabulary for both marks: the badge chip and the child dot read from
 *  the same state, so a paused parent never paints one hue and its child another. */
const STATE_VARIANT: Record<
	DockerContainer["stateIcon"],
	{ badge: BadgeVariant; dot: StatusDotVariant }
> = {
	ok: { badge: "success", dot: "success" },
	warn: { badge: "error", dot: "error" },
	paused: { badge: "neutral", dot: "neutral" },
	unknown: { badge: "neutral", dot: "neutral" },
};

function ContainerRow({ c }: { c: DockerContainer }) {
	const [open, setOpen] = useState(false);
	const hasChildren = (c.children?.length ?? 0) > 0;
	const variant = STATE_VARIANT[c.stateIcon];
	return (
		<Stack direction="horizontal" gap={3} vAlign="start" className={styles.row}>
			{/* The fetcher resolved the container's `glance.icon` label, so a black
          glyph (the bundled mark, any si:/mdi: shorthand) arrives flagged and
          is inverted here — on a dark-only theme, unfilled black is nothing. */}
			<img
				src={c.icon.url || "/dockerhub.svg"}
				alt=""
				loading="lazy"
				className={c.icon.autoInvert ? `${styles.icon} ${styles.iconAutoInvert}` : styles.icon}
				data-testid="docker-icon"
			/>
			<Stack gap={0.5} className={styles.body}>
				<Stack direction="horizontal" gap={2} vAlign="center" className={styles.titleRow}>
					{c.url ? (
						<Link
							href={c.url}
							target={c.sameTab ? undefined : "_blank"}
							hasUnderline={false}
							className={styles.link}
							maxLines={1}
						>
							{/* The name is the row's link label: no color prop, so it
                  inherits the Link's accent and wears tappable purple
                  with the kit's own hover tint. */}
							<Text data-testid="docker-name" color="inherit">
								{c.name}
							</Text>
						</Link>
					) : (
						<Text data-testid="docker-name">{c.name}</Text>
					)}
					{/* Count/state goes to Badge, not a hand-rolled pill: the kit owns the
              5px radius, the wash and the semantic colour set. Tooltip, not a
              native `title` — BaseProps omits title on purpose. */}
					<Tooltip content={`${c.state}: ${c.stateText}`} placement="above">
						<Badge
							variant={variant.badge}
							label={c.stateText || c.state || "unknown"}
							className={styles.badge}
							data-testid={`docker-state-${c.stateIcon}`}
						/>
					</Tooltip>
				</Stack>
				<Text type="supporting" maxLines={1}>
					{c.image}
				</Text>
				{c.description ? (
					<Text type="supporting" maxLines={1}>
						{c.description}
					</Text>
				) : null}
				{hasChildren ? (
					<>
						<Button
							label={`${c.children!.length} container${c.children!.length === 1 ? "" : "s"}`}
							variant="ghost"
							size="sm"
							onClick={() => setOpen(!open)}
							aria-expanded={open}
							className={styles.expand}
							icon={
								<ChevronRight size={12} className={open ? styles.chevronOpen : styles.chevron} />
							}
						/>
						{open ? (
							<ul className={styles.children}>
								{c.children!.map((child) => (
									<li key={child.name} className={styles.child}>
										{/* Status goes to StatusDot: the kit owns the 8px mark and
                        the accessible name, so the row needs no hand-rolled dot. */}
										<StatusDot
											variant={STATE_VARIANT[child.stateIcon].dot}
											label={`${child.name} ${child.stateText || child.state}`}
											data-testid={`docker-state-${child.stateIcon}`}
										/>
										<Text type="supporting" maxLines={1} className={styles.childName}>
											{child.name}
										</Text>
										<Text type="supporting" className={styles.childState}>
											{child.stateText || child.state}
										</Text>
									</li>
								))}
							</ul>
						) : null}
					</>
				) : null}
			</Stack>
		</Stack>
	);
}

function DockerContainers({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as DockerContainersConfig;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	const containers = ((data as DockerData | null) ?? []) as DockerData;
	return (
		<WidgetChrome
			title={cfg.title ?? "Docker"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			error={error}
			showErrors={cfg["show-errors"]}
			isLoading={loading}
			collapseAfter={8}
			items={containers.map((c) => <ContainerRow key={c.name} c={c} />)}
		/>
	);
}

registerWidgetComponent("docker-containers", DockerContainers);

export default DockerContainers;
