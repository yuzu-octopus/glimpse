import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { VIDEOS_DEFAULTS, type VideosConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useAge } from '../_hooks/useAge';
import { formatAge } from '../_hooks/useRelativeTime';
import type { Video } from '../../../shared/widgets/payloads';
import styles from './videos.module.css';
import Feed, { type FeedItem } from '../feed/feed';
import chromeStyles from '../../components/widget-chrome.module.css';

function Card({ video }: { video: Video }) {
  const rawAge = useAge(video.published);
  const age = rawAge || null;
  return (
    <Link href={video.url} target="_blank" className={styles.card} hasUnderline={false} color="inherit">
      {video.thumbnail ? (
        <img src={video.thumbnail} alt="" loading="lazy" className={styles.cardThumb} />
      ) : (
        <div className={styles.cardThumbPlaceholder} />
      )}
      <span className={styles.cardTitle}>{video.title}</span>
      <span className={styles.cardMeta}>
        {age ? <span className={styles.cardTime}>{age}</span> : null}
        <span className={styles.cardChannel}>{video.channel}</span>
      </span>
    </Link>
  );
}

function Videos({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as VideosConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const videos = ((data as { videos?: Video[] } | null)?.videos ?? []) as Video[];
  const style = cfg.style ?? VIDEOS_DEFAULTS.style;
  const collapseAfter = style === 'grid-cards' ? cfg['collapse-after-rows'] : cfg['collapse-after'];
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
      />
    );
  }

  if (videos.length === 0 && !error) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
      >
        <div className={styles.placeholder}>No videos — check channels</div>
      </WidgetChrome>
    );
  }

  if (style === 'vertical-list') {
    const feedItems: FeedItem[] = videos.map((v) => {
      const age = v.published ? formatAge((Date.now() - Date.parse(v.published)) / 1000) : null;
      const meta = [age, v.channel].filter(Boolean).join(' • ');
      return {
        title: v.title,
        url: v.url,
        meta: meta || null,
        image: v.thumbnail,
      };
    });
    const hasCollapse =
      typeof collapseAfter === 'number' && collapseAfter >= 0 && feedItems.length > collapseAfter;
    const visible = hasCollapse && !expanded ? feedItems.slice(0, collapseAfter) : feedItems;
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
      >
        <Feed items={visible} layout="list" />
        {hasCollapse ? (
          expanded ? (
            <button
              type="button"
              className={`${chromeStyles.more} ${chromeStyles.moreExpanded}`}
              onClick={() => setExpanded(false)}
            >
              Show less
              <ChevronRight size={12} className={chromeStyles.chevron} />
            </button>
          ) : (
            <button type="button" className={chromeStyles.more} onClick={() => setExpanded(true)}>
              {`Show more (${feedItems.length - (collapseAfter as number)})`}
              <ChevronRight size={12} className={chromeStyles.chevron} />
            </button>
          )
        ) : null}
      </WidgetChrome>
    );
  }

  const grid = style === 'grid-cards';
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      error={error}
      collapseAfter={collapseAfter}
      cssClass={[cfg['css-class'], grid ? styles.gridWrap : styles.cards].filter(Boolean).join(' ') || undefined}
      items={videos.map((v) => <Card key={v.url} video={v} />)}
    />
  );
}

registerWidgetComponent('videos', Videos);

export default Videos;
