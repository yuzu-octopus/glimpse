import { useState } from 'react';
import { Banner, Card, Collapsible, Skeleton, Tab, TabList, Text } from '@astryxdesign/core';
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

function columnLabel(col: ColumnPayload, i: number): string {
  return widgetTitle(col.widgets[0]) ?? `Column ${i + 1}`;
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
          <WidgetSlot key={i} widget={w} />
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
          <Tab key={i} value={String(i)} label={widgetTitle(w) ?? `Tab ${i + 1}`} />
        ))}
      </TabList>
      <div className={styles.tabContent}>
        {children[active] ? <WidgetSlot widget={children[active]} /> : null}
      </div>
    </Card>
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
    <div className={styles.page} style={{ maxWidth: WIDTHS[data.width] }}>
      {data.headWidgets.length > 0 ? (
        <div className={styles.headWidgets}>
          {data.headWidgets.map((w, i) => (
            <WidgetSlot key={i} widget={w} />
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
          <Collapsible
            key={i}
            defaultIsOpen
            trigger={<span className={styles.mobileToggle}>{columnLabel(col, i)}</span>}
          >
            <div className={styles.columnWidgets}>
              {col.widgets.map((w, j) => (
                <WidgetSlot key={j} widget={w} />
              ))}
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
