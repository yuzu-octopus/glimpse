import { useState, type ReactNode } from 'react';
import { Banner, Card, Skeleton, Tab, TabList, Text } from '@astryxdesign/core';
import { ChevronDown } from 'lucide-react';
import type { ColumnPayload, WidgetPayload } from '../../shared/api';
import type { WidgetType } from '../../shared/config';
import { WidgetChrome } from '../components/WidgetChrome';
import { usePageData } from '../hooks/usePageData';
import { clientWidgets } from '../widgets/registry';
import styles from './page.module.css';

const WIDTHS = { default: 1900, slim: 1300, wide: 1600 } as const;

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
  return (
    <Card padding={0}>
      <TabList
        value={String(active)}
        onChange={(v) => setActive(Number(v))}
        hasDivider
      >
        {children.map((w, i) => (
          <Tab key={widgetKey(w, i)} value={String(i)} label={widgetTitle(w) ?? `Tab ${i + 1}`} />
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
function MobileColumn({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.column}>
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

export function PageView({ slug }: { slug: string }) {
  const state = usePageData(slug);

  if (state.status === 'loading') {
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
          gridTemplateColumns: data.columns
            .map((c) => (c.size === 'small' ? '300px' : 'minmax(0, 1fr)'))
            .join(' '),
        }}
      >
        {data.columns.map((col, i) => (
          // Columns are a config-static list (never reordered at runtime),
          // so the positional index is their stable identity.
          <MobileColumn key={columnKey(col, i)} label={columnLabel(col, i)}>
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
