import { ClickableCard, Stack, StatusDot, Text } from "@astryxdesign/core";
import { useState } from "react";
import { VIDEOS_DEFAULTS, type VideosConfig } from "../../../shared/widgets/keyed";
import type { Video, VideoSourceIssue } from "../../../shared/widgets/payloads";
import { WidgetChrome } from "../../components/WidgetChrome";
import { useAge } from "../_hooks/useAge";
import Feed from "../feed/feed";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./videos.module.css";

// A thumbnail URL that 404s must cost the picture, not the card: YouTube
// hands out dead `hqdefault.jpg` paths often enough that a bare grey 16:9
// box reads as a broken widget. The placeholder is the same surface the
// null-thumbnail case already draws, so a failed load is invisible.
function Card({ video }: { video: Video }) {
	const rawAge = useAge(video.published);
	const age = rawAge || null;
	const [thumbFailed, setThumbFailed] = useState(false);
	return (
		<ClickableCard
			label={video.title}
			href={video.url}
			target="_blank"
			padding={0}
			className={styles.card}
		>
			{video.thumbnail && !thumbFailed ? (
				<img
					src={video.thumbnail}
					alt=""
					loading="lazy"
					onError={() => setThumbFailed(true)}
					className={styles.cardThumb}
				/>
			) : (
				<div className={styles.cardThumbPlaceholder} />
			)}
			<span className={styles.cardTitle}>{video.title}</span>
			<span className={styles.cardMeta}>
				{age ? <span className={styles.cardTime}>{age}</span> : null}
				<span className={styles.cardChannel}>{video.channel}</span>
			</span>
		</ClickableCard>
	);
}

/** A source that came back empty is a status, not a widget failure: the other
 * sources still render, so this is a StatusDot and the muted name beside it —
 * never a red Banner over content the user can still read. Purple stays
 * tappable-only, so the dot takes the kit's negative variant. */
function SourceIssues({ issues }: { issues: VideoSourceIssue[] }) {
	if (issues.length === 0) return null;
	return (
		<Stack gap={1} className={styles.issues} data-testid="videos-issues">
			{issues.map((issue) => {
				const label = `${issue.source}: ${issue.reason}`;
				return (
					<Stack key={label} direction="horizontal" gap={2} vAlign="center">
						<StatusDot
							variant="error"
							label={label}
							tooltip={label}
							data-testid="videos-source-dot"
						/>
						<Text type="supporting" className={styles.issueSource}>
							{issue.source}
						</Text>
						<Text type="supporting">{issue.reason}</Text>
					</Stack>
				);
			})}
		</Stack>
	);
}

function Videos({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as VideosConfig;
	const loading = isLoading ?? ((data as unknown) == null && !error);
	const payload = (data as { videos?: Video[]; issues?: VideoSourceIssue[] } | null) ?? null;
	const videos = (payload?.videos ?? []) as Video[];
	// Only a widget that actually has something to report carries a notice, so
	// a healthy widget's tree is byte-for-byte what it was before.
	const issues = (payload?.issues ?? []) as VideoSourceIssue[];
	const notice = issues.length > 0 ? <SourceIssues issues={issues} /> : undefined;
	const style = cfg.style ?? VIDEOS_DEFAULTS.style;
	const collapseAfter = style === "grid-cards" ? cfg["collapse-after-rows"] : cfg["collapse-after"];

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

	if (videos.length === 0 && !error) {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				notice={notice}
			>
				<div className={styles.placeholder}>No videos — check channels</div>
			</WidgetChrome>
		);
	}

	if (style === "vertical-list") {
		return (
			<WidgetChrome
				title={cfg.title}
				titleUrl={cfg["title-url"]}
				hideHeader={cfg["hide-header"]}
				cssClass={cfg["css-class"]}
				error={error}
				showErrors={cfg["show-errors"]}
				collapseAfter={collapseAfter}
				notice={notice}
				items={videos.map((v) => <VideoRow key={v.url} video={v} />)}
			/>
		);
	}

	const grid = style === "grid-cards";
	return (
		<WidgetChrome
			title={cfg.title}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			error={error}
			showErrors={cfg["show-errors"]}
			collapseAfter={collapseAfter}
			cssClass={
				[cfg["css-class"], grid ? styles.gridWrap : styles.cards].filter(Boolean).join(" ") ||
				undefined
			}
			items={videos.map((v) => <Card key={v.url} video={v} />)}
			notice={notice}
		/>
	);
}

function VideoRow({ video }: { video: Video }) {
	const age = useAge(video.published) || null;
	const meta = [age, video.channel].filter(Boolean).join(" • ");
	return (
		<Feed
			items={[{ title: video.title, url: video.url, meta: meta || null, image: video.thumbnail }]}
			layout="list"
		/>
	);
}

registerWidgetComponent("videos", Videos);

export default Videos;
