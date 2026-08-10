import { Link } from '@astryxdesign/core';
import { videosSchema } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { Video } from '../../../server/widgets/videos';
import styles from './videos.module.css';

function Card({ video }: { video: Video }) {
  return (
    <Link href={video.url} target="_blank" className={styles.card} hasUnderline={false}>
      {video.thumbnail ? (
        <img src={video.thumbnail} alt="" loading="lazy" className={styles.cardThumb} />
      ) : (
        <div className={styles.cardThumbPlaceholder} />
      )}
      <span className={styles.cardTitle}>{video.title}</span>
      <span className={styles.cardChannel}>{video.channel}</span>
    </Link>
  );
}

function Row({ video }: { video: Video }) {
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
        <div className={styles.rowMeta}>{video.channel}</div>
      </div>
    </div>
  );
}

function Videos({ config, data }: WidgetComponentProps) {
  const cfg = videosSchema.parse(config);
  const videos = ((data as { videos?: Video[] } | null)?.videos ?? []) as Video[];
  const style = cfg.style ?? 'horizontal-cards';
  const collapseAfter = style === 'grid-cards' ? cfg['collapse-after-rows'] : cfg['collapse-after'];

  if (style === 'vertical-list') {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
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
      collapseAfter={collapseAfter}
      cssClass={grid ? styles.gridWrap : styles.cards}
      items={videos.map((v) => <Card key={v.url} video={v} />)}
    />
  );
}

registerWidgetComponent('videos', Videos);

export default Videos;
