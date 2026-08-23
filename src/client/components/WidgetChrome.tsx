import { useContext, useRef, useState, type ReactNode } from 'react';
import { Banner, Card, Link, Skeleton } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { HideHeadersContext } from './HideHeadersContext';
import styles from './widget-chrome.module.css';

interface WidgetChromeProps {
  title?: string;
  titleUrl?: string;
  hideHeader?: boolean;
  cssClass?: string;
  isLoading?: boolean;
  error?: string;
  skeletonShape?: 'list' | 'stat' | 'chart' | 'rows';
  /** When set (>= 0), lists longer than this collapse behind a "Show more"
   * toggle. -1 (glance semantics) — or any negative — never collapses. */
  collapseAfter?: number;
  /** List rows (collapse-aware). When absent, `children` renders as-is. */
  items?: ReactNode[];
  children?: ReactNode;
}

/** Shared card chrome for every widget: header, loading, error, collapse. */
export function WidgetChrome({
  title,
  titleUrl,
  hideHeader,
  cssClass,
  isLoading,
  error,
  skeletonShape,
  collapseAfter,
  items,
  children,
}: WidgetChromeProps) {
  const shape = skeletonShape ?? 'rows';
  const shapeClass =
    shape === 'list'
      ? styles.shapeList
      : shape === 'stat'
        ? styles.shapeStat
        : shape === 'chart'
          ? styles.shapeChart
          : styles.shapeRows;
  const globalHide = useContext(HideHeadersContext);
  const effectiveHide = hideHeader || globalHide;
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const list = items ?? (children === undefined ? [] : [children]);
  const n = collapseAfter ?? 0;
  const has = typeof collapseAfter === 'number' && n >= 0 && list.length > n;
  const visible = has && !expanded ? list.slice(0, n) : list;

  const collapse = () => {
    setExpanded(false);
    // Bring the widget's card back into view (e.g. its "Show more" button
    // scrolled it out of sight) — jsdom lacks scrollIntoView, hence the ?.
    cardRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div className={styles.widget}>
      {!effectiveHide && title ? (
        <div
          className={error ? `${styles.header} ${styles.errorHeader}` : styles.header}
        >
          <span className={styles.titleRow}>
            {titleUrl ? (
              <Link href={titleUrl} className={styles.title} hasUnderline={false}>
                {title}
              </Link>
            ) : (
              <span className={styles.title}>{title}</span>
            )}
            {error ? (
              <span
                className={styles.errorDot}
                data-testid="widget-error-dot"
                aria-label="Widget error"
              />
            ) : null}
          </span>
        </div>
      ) : null}
      <Card ref={cardRef} className={cssClass ? `${styles.bodyCard} ${cssClass}` : styles.bodyCard} padding={0}>
        <div className={styles.body} data-testid="widget-body">
          {isLoading ? (
            <div className={`${styles.skeleton} ${shapeClass}`} data-testid="widget-loading">
              {shape === 'list' ? (
                Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={styles.listRow}>
                    <Skeleton width={24} height={24} radius="rounded" />
                    <div className={styles.listLines}>
                      <Skeleton width="70%" height={12} />
                      <Skeleton width="45%" height={10} />
                    </div>
                  </div>
                ))
              ) : shape === 'stat' ? (
                <>
                  <Skeleton width="100%" height={48} />
                  <Skeleton width="40%" height={12} />
                </>
              ) : shape === 'chart' ? (
                <Skeleton width="100%" height={120} />
              ) : (
                <>
                  <Skeleton width="100%" height={14} />
                  <Skeleton width="92%" height={14} />
                  <Skeleton width="97%" height={14} />
                </>
              )}
            </div>
          ) : error ? (
            <Banner status="error" title={error} />
          ) : (
            <>
              {visible}
              {has ? (
                expanded ? (
                  <button
                    type="button"
                    className={`${styles.more} ${styles.moreExpanded}`}
                    onClick={collapse}
                  >
                    Show less
                    <ChevronRight size={12} className={styles.chevron} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.more}
                    onClick={() => setExpanded(true)}
                  >
                    {`Show more (${list.length - n})`}
                    <ChevronRight size={12} className={styles.chevron} />
                  </button>
                )
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
