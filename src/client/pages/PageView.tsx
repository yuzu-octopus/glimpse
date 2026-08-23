import { Suspense, memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Banner, Card, Tab, TabList, Text } from '@astryxdesign/core';
import { ChevronDown } from 'lucide-react';
import type { WidgetPayload } from '../../shared/api';
import { resolveSpan } from '../../shared/config';
import type { Page } from '../../shared/config';
import type { WidgetType } from '../../shared/config';
import { HideHeadersContext } from '../components/HideHeadersContext';
import { WidgetChrome } from '../components/WidgetChrome';
import { usePageData } from '../hooks/usePageData';
import { clientWidgets } from '../widgets/registry';
import { ensureWidgetLoaded } from '../widgets';
import { PAGE_WIDTHS } from '../../shared/config';
import { COLLAGE_ROW_SPAN_MAX, COLLAGE_ROW_SPAN_MIN, MAX_TILING_COLS, chooseColumnCount, composeBento, getTilingProps, type BentoPlacement, type BentoTile } from './tiling';
import { useCollageTiling } from './useCollageTiling';
import { PREFERRED_SIZES } from '../../shared/widgets/preferredSizes';
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

/** Stable key for a widget slot (title-based, falls back to index). Duplicates get #2,#3 suffixes per render. */
function widgetKey(w: WidgetLike, i: number, counts?: Map<string, number>): string {
  const type = 'type' in w && typeof w.type === 'string' ? w.type : 'widget';
  const title = widgetTitle(w);
  const base = title ? `${type}:${title}` : `${type}:${i}`;
  if (!title || !counts) return base;
  const n = (counts.get(base) ?? 0) + 1;
  counts.set(base, n);
  return n === 1 ? base : `${base}#${n}`;
}

/** Per-render keys for a widget list — appends #2,#3 on duplicate base keys. */
function widgetKeysFor(list: WidgetLike[]): string[] {
  const counts = new Map<string, number>();
  return list.map((w, i) => widgetKey(w, i, counts));
}

/** Column label from the first widget's title. */
function columnLabel(
  col: { size: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
): string {
  return widgetTitle(col.widgets[0]) ?? `Column ${i + 1}`;
}

/** Stable key for a column slot (first widget's key, else index). Supports per-render dedup via counts. */
function columnKey(
  col: { size: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
  counts?: Map<string, number>,
): string {
  return col.widgets[0] ? widgetKey(col.widgets[0], 0, counts) : `column-${i}`;
}

/** Config-only row-span estimate for the loading skeleton (collage mode):
 * Mirrors the hook's 1-8 clamp. */
function estimateRowSpan(w: SkeletonWidget): number {
  const type = w.type ?? '';
  // feed-ish widgets with a declared limit > 5 are tall lists
  if (
    (type === 'rss' || type === 'hacker-news' || type === 'lobsters' || type === 'reddit') &&
    (w.limit ?? 0) > 5
  ) {
    return 3;
  }
  // mid-height: markets/videos/calendar; containers group content
  if (
    type === 'markets' ||
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
 * clamped to the hook's COLLAGE_ROW_SPAN bounds. */
function estimateColumnRowSpan(col: { widgets: SkeletonWidget[] }): number {
  const total = col.widgets.reduce((sum, w) => sum + estimateRowSpan(w), 0);
  return Math.min(Math.max(total, COLLAGE_ROW_SPAN_MIN), COLLAGE_ROW_SPAN_MAX);
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
export function PageSkeleton({ page }: { page: Page & { slug: string } }) {
  const hideHeaders = page['hide-headers'] === true;
  const tilingProps = getTilingProps(page.tiling, page['min-column-width']);
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
            {(() => {
              const wk = widgetKeysFor(page['head-widgets'] as unknown as WidgetLike[]);
              return (page['head-widgets'] as unknown as WidgetLike[]).map((w, i) => (
                <WidgetSkeleton key={wk[i]} widget={w as SkeletonWidget} />
              ));
            })()}
          </div>
        ) : null}
        <div className={tilingProps.className} style={tilingProps.style}>
          {(page as { widgets?: unknown[] }).widgets ? (
            <div className={styles.bentoGrid} data-testid="bento-skeleton" style={{ '--bento-cols': String((page as Record<string, unknown>)['grid-columns'] ?? 12) } as React.CSSProperties}>
              {(() => {
                const list = ((page as { widgets?: unknown[] }).widgets ?? []) as unknown as WidgetLike[];
                const wk = widgetKeysFor(list);
                return list.map((w, i) => (
                  <div key={wk[i]} className={styles.bentoItem}>
                    <WidgetSkeleton widget={w as SkeletonWidget} />
                  </div>
                ));
              })()}
            </div>
          ) : (
            (() => {
              const colCounts = new Map<string, number>();
              return (page.columns ?? []).map((col, i) => (
                <MobileColumn
                  key={columnKey(col, i, colCounts)}
                  label={columnLabel(col, i)}
                  small={col.size === 'small'}
                  span={col.span ?? 1}
                  rowSpan={page.tiling === 'collage' ? estimateColumnRowSpan(col) : undefined}
                >
                <div className={styles.columnWidgets}>
                  {(() => {
                    const wk = widgetKeysFor(col.widgets as unknown as WidgetLike[]);
                    return col.widgets.map((w, j) => (
                      <WidgetSkeleton key={wk[j]} widget={w as SkeletonWidget} />
                    ));
                  })()}
                </div>
              </MobileColumn>
              ));
            })()
          )}
        </div>
      </div>
    </HideHeadersContext.Provider>
  );
}

/** Stable per-span style refs so memoized columns don't see a fresh object each render. */
const spanStyles = new Map<number, CSSProperties>();
function spanStyle(span: number): CSSProperties {
  let s = spanStyles.get(span);
  if (!s) {
    s = { '--col-span': String(span) } as CSSProperties;
    spanStyles.set(span, s);
  }
  return s;
}

/** Renders one widget: registry component, container, or not-implemented. - memo safe: widget ref changes on update per streaming invariant */
const WidgetSlot = memo(function WidgetSlot({ widget }: { widget: WidgetPayload }) {
  if (widget.widgets) return <ContainerWidget widget={widget} />;
  return (
    <Suspense
      fallback={
        <WidgetChrome
          title={widgetTitle(widget)}
          hideHeader={widget.config['hide-header'] === true}
          isLoading
        />
      }
    >
      <WidgetSlotContent widget={widget} />
    </Suspense>
  );
});

function WidgetSlotContent({ widget }: { widget: WidgetPayload }) {
  const Component = clientWidgets.get(widget.type as WidgetType);
  if (!Component) {
    const pending = ensureWidgetLoaded(widget.type as string);
    if (pending) throw pending;
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
    const wk = widgetKeysFor(children as unknown as WidgetLike[]);
    return (
      <div className={styles.splitColumn}>
        {children.map((w, i) => (
          <WidgetSlot key={wk[i]} widget={w} />
        ))}
      </div>
    );
  }
  // When page hide-headers is true, hide the tab strip entirely. Stack
  // all tab panes so no content is trapped behind hidden navigation; the
  // stack gap reuses --widget-gap to stay uniform with columnWidgets.
  if (globalHide) {
    const wk = widgetKeysFor(children as unknown as WidgetLike[]);
    return (
      <div className={styles.groupStack}>
        {children.map((w, i) => (
          <WidgetSlot key={wk[i]} widget={w} />
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
        {(() => {
          const wk = widgetKeysFor(children as unknown as WidgetLike[]);
          return children.map((w, i) => (
            <Tab
              key={wk[i]}
              value={String(i)}
              label={widgetTitle(w) ?? `Tab ${i + 1}`}
              className={i === active ? styles.groupTabCurrent : undefined}
            />
          ));
        })()}
      </TabList>
      <div className={styles.tabContent}>
        {children[active] ? <WidgetSlot widget={children[active]} /> : null}
      </div>
    </Card>
  );
}

/** Column wrapper: on mobile a toggle header collapses the section (glance
 * behavior); on desktop the toggle is hidden and content always shows. - memo: props are stable objects per streaming invariant */
const MobileColumn = memo(function MobileColumn({
  label,
  small,
  span,
  rowSpan,
  style,
  children,
}: {
  label: string;
  small: boolean;
  span?: number;
  rowSpan?: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleToggle = () => {
    const willClose = open;
    if (willClose) {
      const active = document.activeElement;
      const content = contentRef.current;
      if (active instanceof HTMLElement && content?.contains(active)) {
        toggleRef.current?.focus();
      }
    }
    setOpen((v) => !v);
  };
  return (
    <div
      data-testid="column"
      data-span={span && span > 1 ? String(span) : undefined}
      data-row-span={rowSpan && rowSpan > 1 ? String(rowSpan) : undefined}
      className={
        small
          ? `${styles.column} ${styles.smallColumn}`
          : `${styles.column} ${styles.fullColumn}`
      }
      style={style}
    >
      <button
        ref={toggleRef}
        type="button"
        className={styles.mobileToggle}
        aria-expanded={open}
        onClick={handleToggle}
      >
        {label}
        <ChevronDown size={12} className={open ? styles.chevronUp : ''} />
      </button>
      {open ? <div ref={contentRef}>{children}</div> : null}
    </div>
  );
});

const BentoItem = memo(function BentoItem({ placement, resizable, widget }: { placement?: BentoPlacement; resizable: boolean; widget: WidgetPayload }) {
  return (
    <div
      className={styles.bentoItem}
      style={
        placement
          ? ({
              '--bento-x': String(placement.x + 1),
              '--bento-y': String(placement.y + 1),
              '--bento-w': String(placement.w),
              '--bento-h': resizable ? undefined : String(placement.h),
            } as React.CSSProperties)
          : undefined
      }
      data-bento-x={placement?.x}
      data-bento-y={placement?.y}
      data-resizable={String(resizable)}
    >
      <WidgetSlot widget={widget} />
    </div>
  );
});

function BentoGrid({ widgets, gridCols, rowHeight }: { widgets: WidgetPayload[]; gridCols: number; rowHeight: number }) {
  const widgetIds = useMemo(() => widgetKeysFor(widgets as unknown as WidgetLike[]), [widgets]);
  const tiles: BentoTile[] = useMemo(
    () =>
      widgets.map((w, i) => {
        const cfg = w.config as Record<string, unknown>;
        const pref =
          (PREFERRED_SIZES as Record<string, { cols: number | null; rows: number; resizable: boolean; priority: number; zone: 'main' | 'sidebar'; preferredWidth: number | null; preferredHeight: number | null }>)[w.type] ??
          { cols: null, rows: 1, resizable: true, priority: 5, zone: 'main' as const, preferredWidth: null, preferredHeight: null };
        return {
          id: widgetIds[i],
          priority: typeof cfg.priority === 'number' ? cfg.priority : pref.priority,
          span: typeof cfg.span === 'number' ? cfg.span : (pref.cols ?? 1),
          zone: (cfg.zone as 'main' | 'sidebar' | undefined) ?? pref.zone,
          cols: pref.cols,
          rows: pref.rows,
          prefW: pref.preferredWidth,
          prefH: pref.preferredHeight,
          resizable: pref.resizable,
        } satisfies BentoTile;
      }),
    [widgets, widgetIds],
  );
  const placements = useMemo(() => composeBento(tiles, gridCols, { rowUnit: rowHeight }), [tiles, gridCols, rowHeight]);
  const byId = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const tileById = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);
  // mobile 1-col stack via priority: render in priority order so the CSS
  // single-track override (grid-column 1/-1 !important) shows top priority first
  const ordered = useMemo(() => {
    const idxMap = new Map(tiles.map((t) => [t.id, t]));
    return widgets
      .map((w, i) => ({ w, id: widgetIds[i] }))
      .toSorted((a, b) => (idxMap.get(b.id)?.priority ?? 0) - (idxMap.get(a.id)?.priority ?? 0));
  }, [widgets, tiles, widgetIds]);
  return (
    <div
      className={styles.bentoGrid}
      style={{ '--bento-cols': String(gridCols), '--bento-row': `${rowHeight}px` } as React.CSSProperties}
      data-testid="bento-grid"
    >
      {ordered.map(({ w, id }) => {
        const pl = byId.get(id);
        const tile = tileById.get(id);
        const resizable = tile?.resizable ?? true;
        return <BentoItem key={id} placement={pl} resizable={resizable} widget={w} />;
      })}
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
  const tilingForMeasure = getTilingProps(data?.tiling, data?.minColumnWidth);
  const resolvedForPrefs = data as unknown as { columns?: { size: string; widgets: { type: string }[]; span?: number }[]; tiling?: string } | undefined;
  // Single source of truth for collage sizing: per-widget prefs grouped by
  // column (a column with 3 widgets contributes 3 width prefs to the
  // chooser). `tiles` flattens for the column-count chooser;
  // `tilePrefsForHook` reduces each group to one pref, aligned with the
  // container's direct children (the column wrappers) for the measure hook.
  const tileGroups = useMemo(() => {
    if (!resolvedForPrefs?.columns) return [];
    return resolvedForPrefs.columns.map((col) =>
      col.widgets.map((w) => {
        const pref = (
          PREFERRED_SIZES as Record<
            string,
            { preferredWidth: number | null; preferredHeight: number | null; resizable: boolean }
          >
        )[w.type] ?? { preferredWidth: null, preferredHeight: null, resizable: true };
        return { prefW: pref.preferredWidth, prefH: pref.preferredHeight, span: col.span ?? 1, resizable: pref.resizable };
      }),
    );
  }, [resolvedForPrefs?.columns]);
  const tiles = tileGroups.flat();
  const tilePrefsForHook = useMemo(() => {
    if (tileGroups.length === 0) return undefined;
    return tileGroups.map((group) => {
      const heights: number[] = [];
      for (const t of group) if (!t.resizable && t.prefH != null) heights.push(t.prefH);
      if (heights.length === 0) return { prefH: null as number | null, resizable: true };
      return { prefH: Math.max(...heights), resizable: false };
    });
  }, [tileGroups]);
  // Collage measure pass: re-runs when the payload settles/refreshes. The
  // ref is only attached in collage mode (tilingProps.measure), so the hook
  // no-ops for every other tiling. PrefH path uses pref when !resizable.
  useCollageTiling(columnsRef, tilingForMeasure.measure && data ? [data] : [], tilePrefsForHook);
  const isCollageLikeForChooser = data?.tiling === 'collage' || data?.tiling === 'auto';
  const chooserMinW = (data as { minColumnWidth?: number } | undefined)?.minColumnWidth;
  const tilesRef = useRef(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);
  useEffect(() => {
    if (!isCollageLikeForChooser) return;
    const container = columnsRef.current;
    if (!container) return;
    const gap = 23;
    const minW = chooserMinW ?? 300;
    const maxCols = MAX_TILING_COLS;
    // clamp grid tracks to content-derived limit and to actual container width; MAX_TILING_COLS is the grid cap (not PageSchema max 3)
    const compute = () => {
      const W = container.clientWidth || container.getBoundingClientRect().width || 0;
      if (!(W > 0)) return;
      const nStar = chooseColumnCount(W, gap, minW, maxCols, tilesRef.current);
      const actualW = (W - (nStar - 1) * gap) / nStar;
      container.style.setProperty('--min-column-width', `${actualW}px`);
      container.style.gridTemplateColumns = `repeat(${nStar}, 1fr)`;
    };
    compute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isCollageLikeForChooser, chooserMinW]);
  if (!data && !error) {
    if (page) return <PageSkeleton page={page} />;
    // Fallback when rendered without config (direct mounts): structure-ready chrome.
    return (
      <div className={styles.page}>
        <div className={styles.columns}>
          <div className={`${styles.column} ${styles.fullColumn}`} data-testid="column">
            <div className={styles.columnWidgets} data-testid="page-loading">
              <WidgetChrome isLoading />
              <WidgetChrome isLoading />
            </div>
          </div>
        </div>
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
  const tilingProps = getTilingProps(resolved.tiling, resolved.minColumnWidth);
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
            {(() => {
              const wk = widgetKeysFor(resolved.headWidgets as unknown as WidgetLike[]);
              return resolved.headWidgets.map((w, i) => (
                <WidgetSlot key={wk[i]} widget={w} />
              ));
            })()}
          </div>
        ) : null}
        {(resolved as unknown as { widgets?: WidgetPayload[] }).widgets ? (
          <BentoGrid
            widgets={(resolved as unknown as { widgets: WidgetPayload[] }).widgets}
            gridCols={(resolved as unknown as { gridColumns?: number }).gridColumns ?? 12}
            rowHeight={(resolved as unknown as { gridRowHeight?: number }).gridRowHeight ?? 96}
          />
        ) : (
          <div ref={tilingProps.measure || resolved.tiling === 'auto' ? columnsRef : null} className={tilingProps.className} style={tilingProps.style}>
            {(() => {
              // Columns-mode spans: explicit config span wins; otherwise size
              // maps to a 12-col footprint via resolveSpan (Social 4/8 etc).
              let inferred: number[] | undefined;
              if (resolved.tiling !== 'auto' && resolved.tiling !== 'collage') {
                try {
                  inferred = resolveSpan(
                    resolved.columns.map((c) => ({ size: c.size, widgets: [], span: c.span })),
                  );
                } catch {
                  inferred = undefined;
                }
              }
              const colCounts = new Map<string, number>();
              return resolved.columns.map((col, i) => {
                const span = col.span ?? inferred?.[i] ?? 1;
                return (
              <MobileColumn
                key={columnKey(col, i, colCounts)}
                label={columnLabel(col, i)}
                small={col.size === 'small'}
                span={span}
                style={spanStyle(span)}
              >
                <div className={styles.columnWidgets}>
                  {(() => {
                    const wk = widgetKeysFor(col.widgets as unknown as WidgetLike[]);
                    return col.widgets.map((w, j) => (
                      <WidgetSlot key={wk[j]} widget={w} />
                    ));
                  })()}
                </div>
              </MobileColumn>
              );
            });
            })()}
          </div>
        )}
      </div>
    </HideHeadersContext.Provider>
  );
}
