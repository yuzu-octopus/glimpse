import { Link } from '@astryxdesign/core';
import type { VideosConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { Video } from '../../../shared/widgets/payloads';
import styles from './videos.module.css';

function useVideoAge(video: Video): string | null {
  return useRelativeTime(video.published ? (Date.now() - Date.parse(video.published)) / 1000 : 0);
}

function Card({ video }: { video: Video }) {
  const age = useVideoAge(video);
  return (
    <Link href={video.url} target="_blank" className={styles.card} hasUnderline={false}>
      {video.thumbnail ? (
        <img src={video.thumbnail} alt="" loading="lazy" className={styles.cardThumb} />
      ) : (
        <div className={styles.cardThumbPlaceholder} />
      )}
      <span className={styles.cardTitle}>{video.title}</span>
      <span className={styles.cardMeta}>
        {video.published ? <span className={styles.cardTime}>{age}</span> : null}
        <span className={styles.cardChannel}>{video.channel}</span>
      </span>
    </Link>
  );
}

function Row({ video }: { video: Video }) {
  const age = useVideoAge(video);
  return (
    <div className={styles.row}>
      {video.thumbnail ? (
        <img src={video.thumbnail} alt="" loading="lazy" className={styles.rowThumb} />
      ) : (
        <div className={styles.rowThumbPlaceholder} />
      )}
      <div className={styles.rowBody}>
        <Link href={video.url} target="_blank" className={styles.title} hasUnderline={false}>
          {video.title}
        </Link>
        <div className={styles.rowMeta}>
          {video.published ? <span className={styles.rowTime}>{age}</span> : null}
          <span className={styles.rowChannel}>{video.channel}</span>
        </div>
      </div>
    </div>
  );
}

function Videos({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as VideosConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const videos = ((data as { videos?: Video[] } | null)?.videos ?? []) as Video[];
  const style = cfg.style ?? 'horizontal-cards';
  const collapseAfter = style === 'grid-cards' ? cfg['collapse-after-rows'] : cfg['collapse-after'];

  // Loading: data is null and no error yet (fetch in flight). Keep chrome
  // so PageView skeleton and WidgetChrome isLoading stay consistent.
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

  // Empty: valid response but no videos (e.g. no channels, all feeds failed,
  // or channels have no recent videos). Show actionable placeholder.
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
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
        collapseAfter={collapseAfter}
        items={videos.map((v) => <Row key={v.url} video={v} />)}
      />
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
