import { Link } from '@astryxdesign/core';
import type { RssConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { RssItem } from '../../../server/widgets/rss';
import styles from './rss.module.css';

// glance image-placeholder icon (heroicons photo, stroke inherits)
const IMAGE_ICON_PATH =
  'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z';

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-subdue)"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={IMAGE_ICON_PATH} />
    </svg>
  );
}

function Meta({ item, className }: { item: RssItem; className?: string }) {
  const age = item.published ? (Date.now() - Date.parse(item.published)) / 1000 : 0;
  const ageText = useRelativeTime(age);
  return (
    <div className={className}>
      <span>{item.source}</span>
      {item.published ? <span>· {ageText}</span> : null}
    </div>
  );
}

function Row({ item, detailed, singleLine }: {
  item: RssItem; detailed: boolean; singleLine: boolean;
}) {
  const titleClass = [
    styles.title,
    detailed ? styles.titleDetailed : undefined,
    singleLine ? styles.titleSingle : styles.titleClamp,
  ].filter(Boolean).join(' ');
  return (
    <div className={styles.row}>
      {detailed ? (
        <div className={styles.thumbContainer}>
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" loading="lazy" className={styles.thumb} />
          ) : (
            <ImageIcon className={styles.thumbPlaceholder} />
          )}
        </div>
      ) : null}
      <div className={styles.content}>
        <Link href={item.url} target="_blank" className={titleClass} hasUnderline={false}>
          {item.title}
        </Link>
        <Meta item={item} className={styles.meta} />
        {detailed && item.description ? (
          <div className={styles.desc}>{item.description}</div>
        ) : null}
        {detailed && (item.categories ?? []).length > 0 ? (
          <div className={styles.chips}>
            {(item.categories ?? []).map((c) => (
              <span key={c} className={styles.chip}>
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Cards({ items, title, titleUrl, hideHeader, cssClass, cardHeight, thumbnailHeight, overlay }: {
  items: RssItem[]; title?: string; titleUrl?: string; hideHeader?: boolean; cssClass?: string;
  cardHeight?: number; thumbnailHeight?: number; overlay?: boolean;
}) {
  return (
    <WidgetChrome title={title} titleUrl={titleUrl} hideHeader={hideHeader} cssClass={cssClass}>
      <div className={styles.cardRow}>
        {items.map((item) =>
          overlay ? (
            <Link
              key={item.url}
              href={item.url}
              target="_blank"
              className={styles.card2}
              style={cardHeight ? { height: cardHeight } : undefined}
              hasUnderline={false}
            >
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" loading="lazy" className={styles.card2Thumb} />
              ) : (
                <ImageIcon className={styles.card2ThumbPlaceholder} />
              )}
              <div className={styles.card2Content}>
                <span className={styles.card2Title}>{item.title}</span>
                <Meta item={item} className={styles.cardMeta} />
              </div>
            </Link>
          ) : (
            <Link key={item.url} href={item.url} target="_blank" className={styles.card} hasUnderline={false}>
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  loading="lazy"
                  className={styles.cardThumb}
                  style={{ height: thumbnailHeight ?? 160 }}
                />
              ) : (
                <div className={styles.cardThumbPlaceholder} style={{ height: thumbnailHeight ?? 160 }}>
                  <ImageIcon className={styles.cardThumbPlaceholderIcon} />
                </div>
              )}
              <div className={styles.cardContent}>
                <span className={styles.cardTitle}>{item.title}</span>
                <Meta item={item} className={styles.cardMeta} />
              </div>
            </Link>
          ),
        )}
      </div>
    </WidgetChrome>
  );
}

function Rss({ config, data }: WidgetComponentProps) {
  const cfg = config as unknown as RssConfig;
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
        cssClass={cfg['css-class']}
        cardHeight={cfg['card-height']}
        thumbnailHeight={cfg['thumbnail-height']}
        overlay={style === 'horizontal-cards-2'}
      />
    );
  }
  const detailed = style === 'detailed-list';
  const singleLine = cfg['single-line-titles'] === true;
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={collapseAfter}
      items={items.map((item) => (
        <Row key={item.url} item={item} detailed={detailed} singleLine={singleLine} />
      ))}
    />
  );
}

registerWidgetComponent('rss', Rss);

export default Rss;
