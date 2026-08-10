import { Link } from '@astryxdesign/core';
import { rssSchema } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { RssItem } from '../../../server/widgets/rss';
import styles from './rss.module.css';

function Row({ item, detailed }: { item: RssItem; detailed: boolean }) {
  const age = item.published ? (Date.now() - Date.parse(item.published)) / 1000 : 0;
  const ageText = useRelativeTime(age);
  return (
    <div className={styles.row}>
      <Link href={item.url} target="_blank" className={styles.title} hasUnderline={false}>
        {item.title}
      </Link>
      {detailed && item.description ? (
        <div className={styles.desc}>{item.description}</div>
      ) : null}
      <div className={styles.meta}>
        <span>{item.source}</span>
        {item.published ? <span>· {ageText}</span> : null}
      </div>
    </div>
  );
}

function Cards({ items, title, titleUrl, hideHeader, cardHeight, thumbnailHeight }: {
  items: RssItem[]; title?: string; titleUrl?: string; hideHeader?: boolean;
  cardHeight?: number; thumbnailHeight?: number;
}) {
  return (
    <WidgetChrome title={title} titleUrl={titleUrl} hideHeader={hideHeader} cssClass={styles.cards}>
      <div className={styles.cardRow}>
        {items.map((item) => (
          <Link key={item.url} href={item.url} target="_blank" className={styles.card} hasUnderline={false}>
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                loading="lazy"
                className={styles.cardThumb}
                style={{ height: thumbnailHeight ?? 80 }}
              />
            ) : (
              <div className={styles.cardThumbPlaceholder} style={{ height: thumbnailHeight ?? 80 }} />
            )}
            <span className={styles.cardTitle} style={cardHeight ? { height: cardHeight } : undefined}>
              {item.title}
            </span>
          </Link>
        ))}
      </div>
    </WidgetChrome>
  );
}

function Rss({ config, data }: WidgetComponentProps) {
  const cfg = rssSchema.parse(config);
  const items = ((data as { items?: RssItem[] } | null)?.items ?? []) as RssItem[];
  const style = cfg.style ?? 'vertical-list';
  const collapseAfter = cfg['collapse-after'];

  if (style === 'horizontal-cards' || style === 'horizontal-cards-2') {
    return (
      <Cards
        items={items}
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cardHeight={cfg['card-height']}
        thumbnailHeight={cfg['thumbnail-height']}
      />
    );
  }
  const detailed = style === 'detailed-list';
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      collapseAfter={collapseAfter}
      items={items.map((item) => <Row key={item.url} item={item} detailed={detailed} />)}
    />
  );
}

registerWidgetComponent('rss', Rss);
