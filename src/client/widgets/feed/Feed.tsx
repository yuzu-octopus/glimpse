import { Link } from '@astryxdesign/core';
import styles from './Feed.module.css';

/**
 * Generic flat feed module — deep module, small interface.
 * One row per item, consistent flat glance styling:
 * - hover: text-highlight (title -> primary), row backdrop
 * - meta subdued, tags vibrant nth-child cycle, image thumbnail
 *
 * Callers map their domain payload to FeedItem; Feed owns layout/colour/hover.
 */
export interface FeedItem {
  title: string;
  url: string;
  /** single meta line — e.g. "example.com • 42 points • 1h" (already joined by caller) */
  meta?: string | null;
  /** optional secondary text (rss description, release notes preview, etc.) */
  description?: string | null;
  /** thumbnail/image url */
  image?: string | null;
  /** legacy single tag */
  tag?: string | null;
  /** multiple chips */
  tags?: string[] | null;
}

export interface FeedProps {
  items: FeedItem[];
  /** when true titles truncate single line; else 2-line clamp (rss single-line-titles) */
  singleLine?: boolean;
}

function chipsFor(item: FeedItem): string[] {
  if (item.tags && item.tags.length > 0) return item.tags;
  if (item.tag) return [item.tag];
  return [];
}

export function Feed({ items, singleLine }: FeedProps) {
  if (items.length === 0) return null;
  return (
    <div>
      {items.map((item) => {
        const chips = chipsFor(item);
        const key = item.url || item.title;
        const titleClass = [styles.title, singleLine ? styles.titleSingle : styles.titleClamp]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={key} className={styles.row}>
            {item.image ? (
              <div className={styles.thumbWrap}>
                <img src={item.image} alt="" loading="lazy" className={styles.thumb} />
              </div>
            ) : null}
            <div className={styles.content}>
              <Link href={item.url} target="_blank" className={titleClass} hasUnderline={false}>
                {item.title}
              </Link>
              {item.meta ? <div className={styles.meta}>{item.meta}</div> : null}
              {item.description ? <div className={styles.desc}>{item.description}</div> : null}
              {chips.length > 0 ? (
                <div className={styles.chips}>
                  {chips.map((c) => (
                    <span key={c} className={styles.chip}>
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Feed;
