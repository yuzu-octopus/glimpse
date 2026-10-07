import { Avatar, Button, Link, StatusDot, Text } from "@astryxdesign/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TwitchChannelsData } from "../../../shared/widgets/payloads";
import {
	TWITCH_CHANNELS_DEFAULTS,
	type TwitchChannelsConfig,
} from "../../../shared/widgets/twitch";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./twitch-channels.module.css";

function formatViewers(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;
}

function TwitchChannels({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as TwitchChannelsConfig;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	const streams = ((data as TwitchChannelsData | null) ?? []) as TwitchChannelsData;
	const collapseAfter = cfg["collapse-after"] ?? TWITCH_CHANNELS_DEFAULTS["collapse-after"];
	const [expanded, setExpanded] = useState(false);
	const hasCollapse = collapseAfter >= 0 && streams.length > collapseAfter;
	const visible = hasCollapse && !expanded ? streams.slice(0, collapseAfter) : streams;

	if (loading) {
		return (
			<WidgetChrome
				title={cfg.title ?? "Twitch"}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				isLoading
				error={error}
				showErrors={cfg["show-errors"]}
			/>
		);
	}

	return (
		<WidgetChrome
			title={cfg.title ?? "Twitch"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			isLoading={loading}
			error={error}
			showErrors={cfg["show-errors"]}
		>
			{streams.length === 0 && !loading ? (
				<div className={styles.empty}>No channels tracked</div>
			) : null}
			<ul className={styles.list}>
				{visible.map((s) => (
					<li key={s.login} className={`${styles.row} ${s.live ? "" : styles.offline}`}>
						{/* profile_image_url is fetched for every channel, live or not,
                and nothing rendered it — so an offline row had no mark at all.
                glance leads every channel with the avatar. Decorative: the
                channel name is the row's own link right beside it. */}
						{s.profileImageUrl ? (
							<Avatar
								src={s.profileImageUrl}
								alt=""
								tooltip={false}
								size="sm"
								data-testid="twitch-avatar"
							/>
						) : null}
						{s.live && s.thumbnailUrl ? (
							<img src={s.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
						) : null}
						<div className={styles.body}>
							<Link
								href={s.url}
								target="_blank"
								weight="semibold"
								hasUnderline={false}
								className={styles.name}
							>
								{/* the kit's StatusDot owns the pulse and the accessible name;
								 * red is the negative hue and a live stream is not a failure */}
								{s.live ? <StatusDot variant="success" label="Live" isPulsing /> : null}
								{s.displayName}
							</Link>
							{s.live ? (
								<Text as="div" type="body" color="secondary" maxLines={2}>
									{s.title}
								</Text>
							) : (
								<Text as="div" type="body" color="secondary">
									Offline
								</Text>
							)}
							<div className={styles.meta}>
								{s.gameName ? <span>{s.gameName}</span> : null}
								{s.live ? <span>{formatViewers(s.viewerCount)} watching</span> : null}
							</div>
						</div>
					</li>
				))}
			</ul>
			{hasCollapse ? (
				<Button
					variant="ghost"
					size="sm"
					label={
						expanded ? "Show less" : `Show more (${streams.length - (collapseAfter as number)})`
					}
					endContent={<ChevronRight size={12} />}
					onClick={() => setExpanded(!expanded)}
				/>
			) : null}
		</WidgetChrome>
	);
}

registerWidgetComponent("twitch-channels", TwitchChannels);

export default TwitchChannels;
