import { useState, type ReactNode } from 'react';
import { Banner, Card, Skeleton, Tab, TabList, Text } from '@astryxdesign/core';
import { ChevronDown } from 'lucide-react';
import type { ColumnPayload, WidgetPayload } from '../../shared/api';
import type { Page } from '../../shared/config';
import type { WidgetType } from '../../shared/config';
import { WidgetChrome } from '../components/WidgetChrome';
import { usePageData } from '../hooks/usePageData';
import { clientWidgets } from '../widgets/registry';
import styles from './page.module.css';

// glance docs §Pages & Columns: default 1600px / slim 1100px / wide 1920px.
const WIDTHS = { default: 1600, slim: 1100, wide: 1920 } as const;

function widgetTitle(w: WidgetPayload): string | undefined {
  const t = w.config.title;
  return typeof t === 'string' ? t : undefined;
}

/** Stable key for config-driven widget lists (order is static per config). */
function widgetKey(w: WidgetPayload, i: number): string {
  const title = widgetTitle(w);
  return title ? `${w.type}:${title}` : `${w.type}:${i}`;
}

function columnLabel(col: ColumnPayload, i: number): string {
  return widgetTitle(col.widgets[0]) ?? `Column ${i + 1}`;
}

/** Stable key for config-static column lists (order is static per config). */
function columnKey(col: ColumnPayload, i: number): string {
  return col.widgets[0] ? widgetKey(col.widgets[0], 0) : `column-${i}`;
}

/** Config-page shape the loading skeleton needs (subset of WidgetConfig). */
interface SkeletonWidget {
  type?: string;
  title?: string;
  'hide-header'?: boolean;
  widgets?: unknown[];
}

/** Title from a config widget, falling back to its first child (containers). */
function skeletonTitle(w: SkeletonWidget): string | undefined {
  if (typeof w.title === 'string' && w.title) return w.title;
  const first = w.widgets?.[0];
  if (first && typeof first === 'object' && 'title' in first) {
    const t = first.title;
    if (typeof t === 'string' && t) return t;
  }
  return undefined;
}

/** Stable key for a config widget slot (title-based, falls back to index). */
function skeletonKey(w: SkeletonWidget, i: number): string {
  const t = skeletonTitle(w);
  return t ? `${typeof w.type === 'string' ? w.type : 'widget'}:${t}` : `slot-${i}`;
}

/** Stable key for a config column slot. */
function skeletonColumnKey(
  col: { widgets: SkeletonWidget[] },
  i: number,
): string {
  const first = col.widgets[0];
  return first ? skeletonKey(first, 0) : `column-${i}`;
}

/** Skeleton card for one configured widget slot (WidgetChrome isLoading). */
function WidgetSkeleton({ widget }: { widget: SkeletonWidget }) {
  return (
    <WidgetChrome
      title={skeletonTitle(widget)}
      hideHeader={widget['hide-header'] === true}
      isLoading
    />
  );
}

function skeletonColumnLabel(
  col: { size: 'small' | 'full'; widgets: SkeletonWidget[] },
  i: number,
): string {
  const first = col.widgets[0];
  return (first ? skeletonTitle(first) : undefined) ?? `Column ${i + 1}`;
}

/** Per-widget skeleton page mirroring the ready layout from the page config,
 * so first paint shows the real structure with no layout shift on fill. */
function PageSkeleton({ page }: { page: Page & { slug: string } }) {
  return (
    <div
      className={`${styles.page} ${page['center-vertically'] ? styles.centered : ''}`}
      style={{ maxWidth: WIDTHS[page.width ?? 'default'] }}
      data-testid="page-skeleton"
    >
      {page['show-mobile-header'] ? (
        <div className={styles.mobileHeader}>{page.name}</div>
      ) : null}
      {page['head-widgets'] && page['head-widgets'].length > 0 ? (
        <div className={styles.headWidgets}>
          {page['head-widgets'].map((w, i) => (
            <WidgetSkeleton key={skeletonKey(w, i)} widget={w} />
          ))}
        </div>
      ) : null}
      <div className={styles.columns}>
        {page.columns.map((col, i) => (
          <MobileColumn
            key={skeletonColumnKey(col, i)}
            label={skeletonColumnLabel(col, i)}
            small={col.size === 'small'}
          >
            <div className={styles.columnWidgets}>
              {col.widgets.map((w, j) => (
                <WidgetSkeleton key={skeletonKey(w, j)} widget={w} />
              ))}
            </div>
          </MobileColumn>
        ))}
      </div>
    </div>
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
  return (
    <Component
      config={widget.config}
      data={widget.data}
      error={widget.error}
    />
  );
}

/** group (tabs) and split-column (side-by-side) containers. */
function ContainerWidget({ widget }: { widget: WidgetPayload }) {
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
  children,
}: {
  label: string;
  small: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div
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
  const state = usePageData(slug);

  if (state.status === 'loading') {
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
  if (state.status === 'error') {
    return (
      <div className={styles.page}>
        <Banner status="error" title={state.error ?? 'Failed to load page'} />
      </div>
    );
  }

  const data = state.data;

  return (
    <div
      className={`${styles.page} ${data['center-vertically'] ? styles.centered : ''}`}
      style={{ maxWidth: WIDTHS[data.width] }}
    >
      {data['show-mobile-header'] ? (
        <div className={styles.mobileHeader}>{data.name}</div>
      ) : null}
      {data.headWidgets.length > 0 ? (
        <div className={styles.headWidgets}>
          {data.headWidgets.map((w, i) => (
            <WidgetSlot key={widgetKey(w, i)} widget={w} />
          ))}
        </div>
      ) : null}
      <div
        className={styles.columns}
        style={{
          // ponytail: kept verbatim for the pinned test assertion; inert on
          // the flex layout (sizing lives in .fullColumn/.smallColumn).
          gridTemplateColumns: data.columns
            .map((c) => (c.size === 'small' ? '300px' : 'minmax(0, 1fr)'))
            .join(' '),
        }}
      >
        {data.columns.map((col, i) => (
          // Columns are a config-static list (never reordered at runtime),
          // so the positional index is their stable identity.
          <MobileColumn
            key={columnKey(col, i)}
            label={columnLabel(col, i)}
            small={col.size === 'small'}
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
  );
}
