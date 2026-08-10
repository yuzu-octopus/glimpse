import { useRef, useState, type ReactNode } from 'react';
import { Banner, Button, Card, Link, Skeleton } from '@astryxdesign/core';
import styles from './widget-chrome.module.css';

interface WidgetChromeProps {
  title?: string;
  titleUrl?: string;
  hideHeader?: boolean;
  cssClass?: string;
  isLoading?: boolean;
  error?: string;
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
  collapseAfter,
  items,
  children,
}: WidgetChromeProps) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const list = items ?? (children === undefined ? [] : [children]);
  const count = collapseAfter ?? 0;
  const hasCollapse =
    typeof collapseAfter === 'number' &&
    collapseAfter >= 0 &&
    list.length > collapseAfter;
  const visible = hasCollapse && !expanded ? list.slice(0, count) : list;

  const collapse = () => {
    setExpanded(false);
    // Bring the widget's card back into view (e.g. its "Show more" button
    // scrolled it out of sight) — jsdom lacks scrollIntoView, hence the ?.
    cardRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <Card
      ref={cardRef}
      className={cssClass ? `${styles.card} ${cssClass}` : styles.card}
      padding={0}
    >
      {!hideHeader && title ? (
        <div className={styles.header}>
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
      <div className={styles.body} data-testid="widget-body">
        {isLoading ? (
          <div className={styles.skeleton} data-testid="widget-loading">
            <Skeleton width="100%" height={14} />
            <Skeleton width="92%" height={14} />
            <Skeleton width="97%" height={14} />
          </div>
        ) : error ? (
          <div className={styles.error}>
            <Banner status="error" title={error} />
          </div>
        ) : (
          <>
            {visible}
            {hasCollapse ? (
              expanded ? (
                <Button
                  label="Show less"
                  variant="ghost"
                  size="sm"
                  onClick={collapse}
                  className={styles.more}
                />
              ) : (
                <Button
                  label={`Show more (${list.length - count})`}
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(true)}
                  className={styles.more}
                />
              )
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
