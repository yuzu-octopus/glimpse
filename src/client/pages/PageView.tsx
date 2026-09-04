import { Suspense, memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
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
import {
  ROW_UNIT,
  columnPlaceInputs,
  flatPlaceInput,
  getTilingProps,
  place,
  tileResizable,
  type FlatWidgetLike,
  type PlacedTile,
} from './tiling';
import { SKELETON_SHAPE } from '../../shared/widgets/preferredSizes';
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
  col: { size?: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
): string {
  return widgetTitle(col.widgets[0]) ?? `Column ${i + 1}`;
}

/** Stable key for a column slot (first widget's key, else index). Supports per-render dedup via counts. */
function columnKey(
  col: { size?: 'small' | 'full'; widgets: WidgetLike[] },
  i: number,
  counts?: Map<string, number>,
): string {
  return col.widgets[0] ? widgetKey(col.widgets[0], 0, counts) : `column-${i}`;
}

/** Container width for `place()`: window width until the grid mounts, then
 * the measured content box. Live tiles and skeletons use the same hook on
 * equivalent containers, so both sides place identically at every commit. */
function usePlacedWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Skeleton card for one configured widget slot (WidgetChrome isLoading). */
function WidgetSkeleton({ widget }: { widget: SkeletonWidget }) {
  return (
    <WidgetChrome
      title={widgetTitle(widget)}
      hideHeader={widget['hide-header'] === true}
      isLoading
      skeletonShape={SKELETON_SHAPE[widget.type ?? ''] ?? 'rows'}
    />
  );
}

/** Per-widget skeleton page mirroring the ready layout from the page config,
 * so first paint shows the real structure with no layout shift on fill. */
export function PageSkeleton({ page }: { page: Page & { slug: string } }) {
  const hideHeaders = page['hide-headers'] === true;
  const tilingProps = getTilingProps(page.tiling, page['min-column-width']);
  const gridRef = useRef<HTMLDivElement>(null);
  const width = usePlacedWidth(gridRef);
  const flatWidgets = (page as { widgets?: unknown[] }).widgets as FlatWidgetLike[] | undefined;
  const isCollage = page.tiling === 'collage' && !flatWidgets;
  // The same place() call the live tree makes: identical config-only inputs
  // at an equivalent width, so skeleton geometry == tile geometry.
  const placedById = useMemo(() => {
    if (!isCollage || !page.columns) return null;
    let inferred: number[] | undefined;
    try {
      inferred = resolveSpan(page.columns.map((c) => ({ size: c.size, widgets: [], span: c.span })));
    } catch {
      inferred = undefined;
    }
    const placed = place(columnPlaceInputs(page.columns, inferred), width);
    return { placed, spans: page.columns.map((c, i) => c.span ?? inferred?.[i] ?? 1) };
  }, [page, isCollage, width]);
  const flatPlaced = useMemo(() => {
    if (!flatWidgets) return null;
    const ids = widgetKeysFor(flatWidgets as unknown as WidgetLike[]);
    const gridCols = (page as { 'grid-columns'?: number })['grid-columns'] ?? 12;
    return place(
      flatWidgets.map((w, i) => flatPlaceInput(ids[i], w)),
      width,
      { cols: gridCols },
    );
  }, [page, flatWidgets, width]);
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
        <div
          ref={gridRef}
          className={tilingProps.className}
          style={
            placedById
              ? ({
                  ...tilingProps.style,
                  gridTemplateColumns: `repeat(${placedById.placed.cols}, minmax(0, 1fr))`,
                  '--tile-row': `${placedById.placed.rowUnit}px`,
                } as CSSProperties)
              : tilingProps.style
          }
        >
          {flatWidgets ? (
            <div
              className={styles.bentoGrid}
              data-testid="bento-skeleton"
              style={
                {
                  '--bento-cols': String(flatPlaced?.cols ?? 12),
                  '--bento-row': `${ROW_UNIT}px`,
                } as React.CSSProperties
              }
            >
              {(() => {
                const list = flatWidgets as unknown as WidgetLike[];
                const wk = widgetKeysFor(list);
                const byId = new Map((flatPlaced?.tiles ?? []).map((p) => [p.id, p]));
                return list.map((w, i) => {
                  const p = byId.get(wk[i]);
                  const resizable = tileResizable((w as SkeletonWidget).type);
                  return (
                    <div
                      key={wk[i]}
                      className={styles.bentoItem}
                      style={
                        p
                          ? ({
                              '--bento-x': String(p.col + 1),
                              '--bento-y': String(p.row + 1),
                              '--bento-w': String(p.w),
                              '--bento-h': resizable ? undefined : String(p.h),
                            } as React.CSSProperties)
                          : undefined
                      }
                      data-bento-x={p?.col}
                      data-bento-y={p?.row}
                      data-resizable={String(resizable)}
                    >
                      <WidgetSkeleton widget={w as SkeletonWidget} />
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            (() => {
              // Spans mirror the live tree: collage tiles use their placed
              // footprint from place(); other modes share the ready render's
              // span derivation (explicit span, else size-based resolveSpan).
              const colCounts = new Map<string, number>();
              const byId = new Map((placedById?.placed.tiles ?? []).map((p) => [p.id, p]));
              let inferred: number[] | undefined;
              if (!placedById && page.tiling !== 'auto') {
                try {
                  inferred = resolveSpan(
                    (page.columns ?? []).map((c) => ({ size: c.size, widgets: [], span: c.span })),
                  );
                } catch {
                  inferred = undefined;
                }
              }
              return (page.columns ?? []).map((col, i) => {
                const tile = byId.get(`column-${i}`);
                const span = tile?.w ?? col.span ?? inferred?.[i] ?? 1;
                return (
                  <MobileColumn
                    key={columnKey(col, i, colCounts)}
                    label={columnLabel(col, i)}
                    small={col.size === 'small'}
                    span={span}
                    rowSpan={tile?.h}
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
                );
              });
            })()
          )}
        </div>
      </div>
    </HideHeadersContext.Provider>
  );
}

function DelayedSkeleton({ delay = 250, children }: { delay?: number; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return show ? <>{children}</> : null;
}

/** Stable per-footprint style refs so memoized columns don't see a fresh
 * object each render. `--col-span` drives the column footprint; collage
 * tiles also span their placed rows from place(). */
const tileStyles = new Map<string, CSSProperties>();
function tileStyle(span: number, rowSpan?: number): CSSProperties {
  const key = `${span}x${rowSpan ?? 0}`;
  let s = tileStyles.get(key);
  if (!s) {
    s = {
      '--col-span': String(span),
      ...(rowSpan != null ? { gridRow: `span ${rowSpan}` } : null),
    } as CSSProperties;
    tileStyles.set(key, s);
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
          skeletonShape={SKELETON_SHAPE[(widget.type as string) ?? (widget.config.type as string) ?? ''] ?? 'rows'}
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
  children,
}: {
  label: string;
  small: boolean;
  span?: number;
  rowSpan?: number;
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
      style={tileStyle(span ?? 12, rowSpan)}>
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

const BentoItem = memo(function BentoItem({ placement, resizable, widget }: { placement?: PlacedTile; resizable: boolean; widget: WidgetPayload }) {
  return (
    <div
      className={styles.bentoItem}
      style={
        placement
          ? ({
              '--bento-x': String(placement.col + 1),
              '--bento-y': String(placement.row + 1),
              '--bento-w': String(placement.w),
              '--bento-h': resizable ? undefined : String(placement.h),
            } as React.CSSProperties)
          : undefined
      }
      data-bento-x={placement?.col}
      data-bento-y={placement?.row}
      data-resizable={String(resizable)}
    >
      <WidgetSlot widget={widget} />
    </div>
  );
});

function BentoGrid({ widgets, gridCols, rowHeight }: { widgets: WidgetPayload[]; gridCols: number; rowHeight: number }) {
  const widgetIds = useMemo(() => widgetKeysFor(widgets as unknown as WidgetLike[]), [widgets]);
  const gridRef = useRef<HTMLDivElement>(null);
  const width = usePlacedWidth(gridRef);
  // place() inputs double as the priority source: the same call the flat
  // skeleton makes, so live tiles and shimmer agree at every width.
  const inputs = useMemo(
    () =>
      widgets.map((w, i) => {
        const cfg = w.config as Record<string, unknown>;
        return flatPlaceInput(widgetIds[i], {
          type: w.type,
          span: typeof cfg.span === 'number' ? cfg.span : undefined,
          priority: typeof cfg.priority === 'number' ? cfg.priority : undefined,
          zone: cfg.zone as 'main' | 'sidebar' | undefined,
          limit: typeof cfg.limit === 'number' ? cfg.limit : undefined,
        });
      }),
    [widgets, widgetIds],
  );
  const placed = useMemo(() => place(inputs, width, { cols: gridCols, rowUnit: rowHeight }), [inputs, width, gridCols, rowHeight]);
  const byId = useMemo(() => new Map(placed.tiles.map((t) => [t.id, t])), [placed]);
  // mobile 1-col stack via priority: render in priority order so the CSS
  // single-track override (grid-column 1/-1 !important) shows top priority first
  const ordered = useMemo(() => {
    const prio = new Map(inputs.map((t) => [t.id, t.priority]));
    return widgets
      .map((w, i) => ({ w, id: widgetIds[i] }))
      .toSorted((a, b) => (prio.get(b.id) ?? 0) - (prio.get(a.id) ?? 0));
  }, [widgets, inputs, widgetIds]);
  return (
    <div
      ref={gridRef}
      className={styles.bentoGrid}
      style={{ '--bento-cols': String(placed.cols), '--bento-row': `${placed.rowUnit}px` } as React.CSSProperties}
      data-testid="bento-grid"
    >
      {ordered.map(({ w, id }) => (
        <BentoItem key={id} placement={byId.get(id)} resizable={tileResizable(w.type)} widget={w} />
      ))}
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
  const gridRef = useRef<HTMLDivElement>(null);
  const width = usePlacedWidth(gridRef);
  // Collage geometry from place() — the same call the skeleton makes, so
  // tiles == skeletons at every width. Above the early returns: hooks stay
  // unconditional across loading / error / ready states.
  const flatLive = (data as unknown as { widgets?: WidgetPayload[] } | undefined)?.widgets;
  const isCollage = data?.tiling === 'collage' && !flatLive;
  const placedById = useMemo(() => {
    if (!isCollage || !data) return null;
    let inferred: number[] | undefined;
    try {
      inferred = resolveSpan(data.columns.map((c) => ({ size: c.size, widgets: [], span: c.span })));
    } catch {
      inferred = undefined;
    }
    const placed = place(
      columnPlaceInputs(
        data.columns.map((c) => ({
          span: c.span,
          widgets: c.widgets.map((w) => ({
            type: w.type,
            limit: typeof w.config.limit === 'number' ? w.config.limit : undefined,
          })),
        })),
        inferred,
      ),
      width,
    );
    return { placed, spans: data.columns.map((c, i) => c.span ?? inferred?.[i] ?? 1) };
  }, [data, isCollage, width]);
  if (!data && !error) {
    if (page)
      return (
        <DelayedSkeleton>
          <PageSkeleton page={page} />
        </DelayedSkeleton>
      );
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
          <div
            ref={gridRef}
            className={tilingProps.className}
            style={
              placedById
                ? ({
                    ...tilingProps.style,
                    gridTemplateColumns: `repeat(${placedById.placed.cols}, minmax(0, 1fr))`,
                    '--tile-row': `${placedById.placed.rowUnit}px`,
                  } as CSSProperties)
                : tilingProps.style
            }
          >
            {(() => {
              // Spans mirror the skeleton: collage tiles use their placed
              // footprint from place(); other modes derive spans the same
              // way (explicit span, else size-based resolveSpan).
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
              const byId = new Map((placedById?.placed.tiles ?? []).map((p) => [p.id, p]));
              return resolved.columns.map((col, i) => {
                const tile = byId.get(`column-${i}`);
                const span = tile?.w ?? col.span ?? inferred?.[i] ?? 1;
                return (
              <MobileColumn
                key={columnKey(col, i, colCounts)}
                label={columnLabel(col, i)}
                small={col.size === 'small'}
                span={span}
                rowSpan={tile?.h}
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
