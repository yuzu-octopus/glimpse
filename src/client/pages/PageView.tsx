import { useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Banner, Card, Skeleton, Tab, TabList, Text } from '@astryxdesign/core';
import { ChevronDown } from 'lucide-react';
import type { WidgetPayload } from '../../shared/api';
import type { Page } from '../../shared/config';
import type { WidgetType } from '../../shared/config';
import { HideHeadersContext } from '../components/HideHeadersContext';
import { WidgetChrome } from '../components/WidgetChrome';
import { usePageData } from '../hooks/usePageData';
import { clientWidgets } from '../widgets/registry';
import { PAGE_WIDTHS } from '../../shared/layout';
import { useCollageTiling } from './useCollageTiling';
import styles from './page.module.css';

/** Config-page shape the loading skeleton needs (subset of WidgetConfig). */
interface SkeletonWidget {
  type?: string;
  title?: string;
  'hide-header'?: boolean;
  limit?: number;
  widgets?: unknown[];
}

/** Widget shape the title/key helpers accept: a fetched payload widget
 * (title under `.config.title`) or a config record (top-level title). */
type WidgetLike = WidgetPayload | SkeletonWidget;

/** Title from a widget: payload `.config.title`, config `title`, or the
 * first child's title (containers). */
function widgetTitle(w: WidgetLike | undefined): string | undefined {
  if (!w) return undefined;
  const t = 'config' in w ? w.config.title : w.title;
  if (typeof t === 'string' && t) return t;
  const first = w.widgets?.[0];
  if (
    first &&
    typeof first === 'object' &&
    'title' in first &&
    typeof first.title === 'string' &&
    first.title
  ) {
    return first.title;
  }
  return undefined;
}

/** Stable key for a widget slot (title-based, falls back to index). */
function widgetKey(w: WidgetLike, i: number): string {
  const type = 'type' in w && typeof w.type === 'string' ? w.type : 'widget';
  const title = widgetTitle(w);
  return title ? `${type}:${title}` : `${type}:${i}`;
}

/** Column label from the first widget's title. */
function columnLabel(
  col: { size: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
): string {
  return widgetTitle(col.widgets[0]) ?? `Column ${i + 1}`;
}

/** Stable key for a column slot (first widget's key, else index). */
function columnKey(
  col: { size: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
): string {
  return col.widgets[0] ? widgetKey(col.widgets[0], 0) : `column-${i}`;
}

/** Config-only row-span estimate for the loading skeleton (collage mode):
 * bounds CLS between first paint and the measured pass on hydration.
 * Mirrors the hook's 1-4 clamp. */
function estimateRowSpan(w: SkeletonWidget): number {
  const type = w.type ?? '';
  // feed-ish widgets with a declared limit > 5 are tall lists
  if (
    (type === 'rss' || type === 'hacker-news' || type === 'lobsters' || type === 'reddit') &&
    (w.limit ?? 0) > 5
  ) {
    return 3;
  }
  // mid-height: markets/twitch/videos/calendar; containers group content
  if (
    type === 'markets' ||
    type === 'twitch-channels' ||
    type === 'twitch-top-games' ||
    type === 'videos' ||
    type === 'calendar' ||
    type === 'group' ||
    type === 'split-column'
  ) {
    return 2;
  }
  // clock/weather/search/monitor/iframe/bookmarks + anything unknown: 1 row
  return 1;
}

/** Skeleton tile (one column) spans the sum of its widgets' estimates,
 * clamped to the hook's 1-4 bound. */
function estimateColumnRowSpan(col: { widgets: SkeletonWidget[] }): number {
  const total = col.widgets.reduce((sum, w) => sum + estimateRowSpan(w), 0);
  return Math.min(Math.max(total, 1), 4);
}

/** Skeleton card for one configured widget slot (WidgetChrome isLoading). */
function WidgetSkeleton({ widget }: { widget: SkeletonWidget }) {
  return (
    <WidgetChrome
      title={widgetTitle(widget)}
      hideHeader={widget['hide-header'] === true}
      isLoading
    />
  );
}

/** Per-widget skeleton page mirroring the ready layout from the page config,
 * so first paint shows the real structure with no layout shift on fill. */
function PageSkeleton({ page }: { page: Page & { slug: string } }) {
  const hideHeaders = page['hide-headers'] === true;
  return (
    <HideHeadersContext.Provider value={hideHeaders}>
      <div
        className={`${styles.page} ${page['center-vertically'] ? styles.centered : ''}`}
        style={{ maxWidth: PAGE_WIDTHS[page.width ?? 'default'] }}
        data-testid="page-skeleton"
      >
        {page['show-mobile-header'] ? (
          <div className={styles.mobileHeader}>{page.name}</div>
        ) : null}
        {page['head-widgets'] && page['head-widgets'].length > 0 ? (
          <div className={styles.headWidgets}>
            {page['head-widgets'].map((w, i) => (
              <WidgetSkeleton key={widgetKey(w, i)} widget={w} />
            ))}
          </div>
        ) : null}
        <div
          className={
            page.tiling === 'collage'
              ? `${styles.columns} ${styles.collageTiling}`
              : page.tiling === 'auto'
                ? `${styles.columns} ${styles.autoTiling}`
                : styles.columns
          }
          style={
            page.tiling === 'collage' || page.tiling === 'auto'
              ? ({
                  '--min-column-width': `${page['min-column-width'] ?? 300}px`,
                } as CSSProperties)
              : undefined
          }
        >
          {page.columns.map((col, i) => (
            <MobileColumn
              key={columnKey(col, i)}
              label={columnLabel(col, i)}
              small={col.size === 'small'}
              span={col.span ?? 1}
              rowSpan={
                page.tiling === 'collage' ? estimateColumnRowSpan(col) : undefined
              }
            >
              <div className={styles.columnWidgets}>
                {col.widgets.map((w, j) => (
                  <WidgetSkeleton key={widgetKey(w, j)} widget={w} />
                ))}
              </div>
            </MobileColumn>
          ))}
        </div>
      </div>
    </HideHeadersContext.Provider>
  );
}

/** Renders one widget: registry component, container, or not-implemented. */
function WidgetSlot({ widget }: { widget: WidgetPayload }) {
  const Component = clientWidgets.get(widget.type as WidgetType);

  if (widget.widgets) return <ContainerWidget widget={widget} />;
  if (!Component) {
    return (
      <WidgetChrome
        title={widgetTitle(widget)}
        hideHeader={widget.config['hide-header'] === true}
        error={widget.error}
      >
        <Text type="supporting">Widget "{widget.type}" is not implemented yet.</Text>
      </WidgetChrome>
    );
  }
  const isLoading = widget.data == null && !widget.error;
  return (
    <Component
      config={widget.config}
      data={widget.data}
      error={widget.error}
      isLoading={isLoading}
    />
  );
}

/** group (tabs) and split-column (side-by-side) containers. */
function ContainerWidget({ widget }: { widget: WidgetPayload }) {
  const globalHide = useContext(HideHeadersContext);
  const children = widget.widgets ?? [];
  const [active, setActive] = useState(0);

  if (widget.type === 'split-column') {
    return (
      <div className={styles.splitColumn}>
        {children.map((w, i) => (
          <WidgetSlot key={widgetKey(w, i)} widget={w} />
        ))}
      </div>
    );
  }
  // When page hide-headers is true, hide the tab strip entirely. Stack
  // all tab panes so no content is trapped behind hidden navigation; the
  // stack gap reuses --widget-gap to stay uniform with columnWidgets.
  if (globalHide) {
    return (
      <div className={styles.groupStack}>
        {children.map((w, i) => (
          <WidgetSlot key={widgetKey(w, i)} widget={w} />
        ))}
      </div>
    );
  }
  const groupTitleUrl = (() => {
    const t = widget.config['title-url'];
    return typeof t === 'string' && t ? t : undefined;
  })();
  return (
    <Card padding={0}>
      <TabList
        value={String(active)}
        className={styles.groupTabs}
        aria-label="Group tabs"
        onChange={(v) => {
          const next = Number(v);
          // glance: clicking the already-active tab opens the group title-url
          if (next === active && groupTitleUrl) {
            window.open(groupTitleUrl, '_blank', 'noopener,noreferrer');
          } else {
            setActive(next);
          }
        }}
      >
        {children.map((w, i) => (
          <Tab
            key={widgetKey(w, i)}
            value={String(i)}
            label={widgetTitle(w) ?? `Tab ${i + 1}`}
            className={i === active ? styles.groupTabCurrent : undefined}
          />
        ))}
      </TabList>
      <div className={styles.tabContent}>
        {children[active] ? <WidgetSlot widget={children[active]} /> : null}
      </div>
    </Card>
  );
}

/** Column wrapper: on mobile a toggle header collapses the section (glance
 * behavior); on desktop the toggle is hidden and content always shows. */
function MobileColumn({
  label,
  small,
  span,
  rowSpan,
  children,
}: {
  label: string;
  small: boolean;
  /** Auto-tiling grid span (1-4); undefined keeps the default single track. */
  span?: number;
  /** Collage estimated row span (1-4); skeleton only — the live hook
   * overwrites these with measured spans on hydrate. */
  rowSpan?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div
      // grid-column: span N is a no-op for 1 — only emit the hint above 1.
      data-span={span && span > 1 ? String(span) : undefined}
      data-row-span={rowSpan && rowSpan > 1 ? String(rowSpan) : undefined}
      className={
        small
          ? `${styles.column} ${styles.smallColumn}`
          : `${styles.column} ${styles.fullColumn}`
      }
    >
      <button
        type="button"
        className={styles.mobileToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown size={12} className={open ? styles.chevronUp : ''} />
      </button>
      {open ? children : null}
    </div>
  );
}

export function PageView({
  slug,
  page,
}: {
  slug: string;
  /** Page config from /api/config: drives the skeleton-first loading layout. */
  page?: Page & { slug: string };
}) {
  const { data, error } = usePageData(slug);
  const columnsRef = useRef<HTMLDivElement>(null);
  // Collage measure pass: re-runs when the payload settles/refreshes. The
  // ref is only attached in collage mode (ref={collage ? columnsRef : null}
  // below), so the hook no-ops for every other tiling.
  useCollageTiling(columnsRef, data && data.tiling === 'collage' ? [data] : []);

  if (!data && !error) {
    if (page) return <PageSkeleton page={page} />;
    // Fallback when rendered without config (direct mounts): generic block.
    return (
      <div className={styles.page}>
        <Card padding={0}>
          <div className={styles.columnWidgets} data-testid="page-loading">
            <Skeleton width="100%" height={120} />
            <Skeleton width="100%" height={120} />
          </div>
        </Card>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className={styles.page}>
        <Banner status="error" title={error ?? 'Failed to load page'} />
      </div>
    );
  }

  // Stale-while-revalidate: data is still rendered while isValidating; no skeleton flicker
  const resolved = data!;
  const hideHeaders = resolved['hide-headers'] === true || resolved.hideHeaders === true;
  return (
    <HideHeadersContext.Provider value={hideHeaders}>
      <div
        className={`${styles.page} ${resolved['center-vertically'] ? styles.centered : ''}`}
        style={{ maxWidth: PAGE_WIDTHS[resolved.width] }}
      >
        {resolved['show-mobile-header'] ? (
          <div className={styles.mobileHeader}>{resolved.name}</div>
        ) : null}
        {resolved.headWidgets.length > 0 ? (
          <div className={styles.headWidgets}>
            {resolved.headWidgets.map((w, i) => (
              <WidgetSlot key={widgetKey(w, i)} widget={w} />
            ))}
          </div>
        ) : null}
        <div
          ref={resolved.tiling === 'collage' ? columnsRef : null}
          className={
            resolved.tiling === 'collage'
              ? `${styles.columns} ${styles.collageTiling}`
              : resolved.tiling === 'auto'
                ? `${styles.columns} ${styles.autoTiling}`
                : styles.columns
          }
          style={
            resolved.tiling === 'collage' || resolved.tiling === 'auto'
              ? ({ '--min-column-width': `${resolved.minColumnWidth}px` } as CSSProperties)
              : undefined
          }
        >
          {resolved.columns.map((col, i) => (
            // Columns are a config-static list (never reordered at runtime),
            // so the positional index is their stable identity.
            <MobileColumn
              key={columnKey(col, i)}
              label={columnLabel(col, i)}
              small={col.size === 'small'}
              span={col.span ?? 1}
            >
              <div className={styles.columnWidgets}>
                {col.widgets.map((w, j) => (
                  <WidgetSlot key={widgetKey(w, j)} widget={w} />
                ))}
              </div>
            </MobileColumn>
          ))}
        </div>
      </div>
    </HideHeadersContext.Provider>
  );
}
