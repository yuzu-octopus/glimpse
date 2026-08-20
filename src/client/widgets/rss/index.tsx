import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import type { RssConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { RssItem } from '../../../shared/widgets/payloads';
import styles from './rss.module.css';
import Feed, { type FeedItem } from '../feed/Feed';
import chromeStyles from '../../components/widget-chrome.module.css';

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

function toFeedItems(items: RssItem[], detailed: boolean): FeedItem[] {
  return items.map((item) => {
    const ageSec = item.published ? (Date.now() - Date.parse(item.published)) / 1000 : 0;
    const meta = item.published ? `${item.source} · ${formatAge(ageSec)}` : item.source;
    return {
      title: item.title,
      url: item.url,
      meta,
      description: detailed ? item.description : null,
      tags: detailed ? item.categories ?? [] : [],
      image: detailed ? item.thumbnail : null,
    };
  });
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
                <div className={styles.cardMeta}>
                  <span>{item.source}</span>
                  {item.published ? <span>· {formatAge((Date.now() - Date.parse(item.published)) / 1000)}</span> : null}
                </div>
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
                <div className={styles.cardMeta}>
                  <span>{item.source}</span>
                  {item.published ? <span>· {formatAge((Date.now() - Date.parse(item.published)) / 1000)}</span> : null}
                </div>
              </div>
            </Link>
          ),
        )}
      </div>
    </WidgetChrome>
  );
}

function Rss({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as RssConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const items = ((data as { items?: RssItem[] } | null)?.items ?? []) as RssItem[];
  const style = cfg.style ?? 'vertical-list';
  const collapseAfter = cfg['collapse-after'];
  const title =
    cfg.title ?? (cfg['source-header'] ? cfg.feeds[0]?.title ?? 'RSS' : undefined);
  const detailed = style === 'detailed-list';
  const singleLine = cfg['single-line-titles'] === true;
  const feedItems = toFeedItems(items, detailed);
  const [expanded, setExpanded] = useState(false);
  const hasCollapse =
    typeof collapseAfter === 'number' && collapseAfter >= 0 && feedItems.length > collapseAfter;
  const visible = hasCollapse && !expanded ? feedItems.slice(0, collapseAfter) : feedItems;

  if (loading) {
    return (
      <WidgetChrome
        title={title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
        error={error}
      />
    );
  }

  if (style === 'horizontal-cards' || style === 'horizontal-cards-2') {
    return (
      <Cards
        items={items}
        title={title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        cardHeight={cfg['card-height']}
        thumbnailHeight={cfg['thumbnail-height']}
        overlay={cfg['overlay'] === true}
      />
    );
  }

  return (
    <WidgetChrome
      title={title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={loading}
      error={error}
    >
      <Feed items={visible} layout="list" singleLine={singleLine} />
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

registerWidgetComponent('rss', Rss);

export default Rss;
