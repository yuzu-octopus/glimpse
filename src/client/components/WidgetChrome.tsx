import { memo, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Card,
  Heading,
  Link,
  Skeleton,
  Stack,
  StatusDot,
} from '@astryxdesign/core';
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
  /** false → quiet failure: the chrome and whatever content it still has stay,
   * no error Banner. The StatusDot beside the title keeps reporting the
   * failure, so quiet never means invisible. Defaults true. */
  showErrors?: boolean;
  skeletonShape?: 'list' | 'stat' | 'chart' | 'rows';
  /** When set (>= 0), lists longer than this collapse behind a "Show more"
   * toggle. -1 (glance semantics) — or any negative — never collapses. */
  collapseAfter?: number;
  /** List rows (collapse-aware). When absent, `children` renders as-is. */
  items?: ReactNode[];
  /** Rendered above the body, outside the scroll rail or grid the body may be.
   * For per-item status a widget still wants on screen — a dead source among
   * live ones. Nothing renders when absent, so a healthy widget is untouched. */
  notice?: ReactNode;
  children?: ReactNode;
}

/** Shared card chrome for every widget: header, loading, error, collapse.
 * Memo'd — polls that leave a widget's props untouched skip re-render. */
export const WidgetChrome = memo(function WidgetChrome({
  title,
  titleUrl,
  hideHeader,
  cssClass,
  isLoading,
  error,
  showErrors,
  skeletonShape,
  collapseAfter,
  items,
  notice,
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
  const list = useMemo(
    () => items ?? (children === undefined ? [] : [children]),
    [items, children],
  );
  // `show-errors: false` mutes the widget: no Banner, no error text, no red
  // header wash. The status dot beside the title is the whole report.
  const loud = Boolean(error) && showErrors !== false;
  const failLabel = title ? `${title} failed to load` : 'This widget failed to load';
  const n = collapseAfter ?? 0;
  const has = typeof collapseAfter === 'number' && n >= 0 && list.length > n;
  // Stable slice identity across renders so the memo wrapper (and row
  // reconcilers downstream) isn't defeated by a fresh array each pass.
  const visible = useMemo(
    () => (has && !expanded ? list.slice(0, n) : list),
    [has, expanded, list, n],
  );

  const collapse = () => {
    setExpanded(false);
    // Bring the widget's card back into view (e.g. its "Show more" button
    // scrolled it out of sight) — jsdom lacks scrollIntoView, hence the ?.
    cardRef.current?.scrollIntoView?.({ block: 'nearest' });
  };

  // One handler for the two-way toggle: expanding is a plain state flip,
  // collapsing also brings the card back into view.
  const toggle = () => {
    if (expanded) collapse();
    else setExpanded(true);
  };

  return (
    <div className={styles.widget}>
      {!effectiveHide && title ? (
        <div
          className={loud ? `${styles.header} ${styles.errorHeader}` : styles.header}
        >
          <Stack
            direction="horizontal"
            vAlign="center"
            gap={1.5}
            className={styles.titleRow}
          >
            {titleUrl ? (
              // Purple = tappable: only a linked title wears the accent.
              <Heading
                level={3}
                className={`${styles.title} ${styles.titleLink}`}
              >
                <Link href={titleUrl} hasUnderline={false}>
                  {title}
                </Link>
              </Heading>
            ) : (
              <Heading level={3} className={styles.title}>
                {title}
              </Heading>
            )}
            {error ? (
              // Status goes to StatusDot, not a hand-rolled box: the kit owns
              // the shape, the accessible name, and the hover explanation.
              <StatusDot
                variant="error"
                label={failLabel}
                tooltip={failLabel}
                data-testid="widget-error-dot"
              />
            ) : null}
          </Stack>
        </div>
      ) : null}
      <Card ref={cardRef} className={cssClass} padding={4}>
        {/* The notice sits outside the body: a body its widget turned into a
            grid or a horizontal rail must not absorb a status row as one more
            cell. A widget-level error owns the whole body, so the notice
            stands down rather than competing with the Banner. */}
        {notice && !loud ? <div className={styles.notice}>{notice}</div> : null}
        <div className={styles.body} data-testid="widget-body">
          {isLoading ? (
            <div className={`${styles.skeleton} ${shapeClass}`} data-testid="widget-loading">
              {shape === 'list' ? (
                Array.from({ length: 5 }, (_, i) => (
                  <Stack key={i} direction="horizontal" vAlign="center" gap={2}>
                    <Skeleton width={24} height={24} radius="rounded" />
                    <Stack direction="vertical" gap={1.5} className={styles.listLines}>
                      <Skeleton width="70%" height={12} />
                      <Skeleton width="45%" height={10} />
                    </Stack>
                  </Stack>
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
          ) : loud ? (
            <Banner status="error" title={error} />
          ) : (
            <>
              {visible}
              {has ? (
                <Button
                  variant="ghost"
                  width="100%"
                  className={styles.toggle}
                  label={expanded ? 'Show less' : `Show more (${list.length - n})`}
                  endContent={
                    <ChevronRight
                      size={12}
                      className={
                        expanded
                          ? `${styles.chevron} ${styles.chevronExpanded}`
                          : styles.chevron
                      }
                    />
                  }
                  onClick={toggle}
                />
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
});
