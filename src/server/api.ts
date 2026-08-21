import type { Page } from '../shared/config';
import type { PagePayload, WidgetPayload } from '../shared/api';
import { serverWidgets, type WidgetFetchContext } from './widgets/registry';
import { fetchWidgetData } from './widgets/runtime';
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function containerChildren(
  config: Record<string, unknown>,
): Record<string, unknown>[] | null {
  if (Array.isArray(config.widgets)) return config.widgets;
  return null;
}

async function fetchWidget(
  ctx: WidgetFetchContext,
  pageSlug: string,
  path: string,
  widget: Record<string, unknown>,
): Promise<WidgetPayload> {
  const type = typeof widget.type === 'string' ? widget.type : 'unknown';
  const payload: WidgetPayload = { type, config: widget, data: null };

  // Container widgets: recurse into children, no own fetch.
  const children = containerChildren(widget);
  if (children) {
    payload.widgets = await Promise.all(
      children.map((child, i) =>
        fetchWidget(ctx, pageSlug, `${path}/${i}`, child),
      ),
    );
    return payload;
  }

  const fetcher = serverWidgets.get(type as never);
  if (!fetcher) return payload; // config-only widget

  const cacheKey = `${pageSlug}:${path}`;
  try {
    const data = await fetchWidgetData(ctx, type, widget, cacheKey, fetcher);
    payload.data = data as WidgetPayload['data'];
  } catch (e) {
    payload.error = e instanceof Error ? e.message : String(e);
  }
  return payload;
}

/** Fetch data for every widget in a page tree, respecting per-widget cache. */
export async function buildPagePayload(
  page: Page & { slug: string },
  ctx: WidgetFetchContext,
): Promise<PagePayload> {
  const buildColumn = (col: { size: 'small' | 'full'; span?: number; widgets: unknown[] }) =>
    Promise.all(
      col.widgets.map((w, i) =>
        fetchWidget(ctx, page.slug, `${col.size === 'small' ? 's' : 'f'}:${i}`, isRecord(w) ? w : { type: 'unknown' }),
      ),
    ).then((widgets) => ({
      size: col.size,
      widgets,
      ...(col.span !== undefined ? { span: col.span } : {}),
    }));

  const headPromise = Array.isArray(page['head-widgets'])
    ? Promise.all(
        page['head-widgets'].map((w, i) =>
          fetchWidget(ctx, page.slug, `h:${i}`, isRecord(w) ? w : { type: 'unknown' }),
        ),
      )
    : Promise.resolve([]);

  const isFlat = Array.isArray((page as Record<string, unknown>).widgets);
  const flatWidgetsPromise: Promise<WidgetPayload[]> = isFlat
    ? Promise.all(
        ((page as { widgets?: unknown[] }).widgets ?? []).map((w, i) =>
          fetchWidget(ctx, page.slug, `w:${i}`, isRecord(w) ? w : { type: 'unknown' }),
        ),
      )
    : Promise.resolve([]);

  const columnsPromise = Array.isArray((page as Record<string, unknown>).columns)
    ? Promise.all(((page as { columns?: Array<{ size: 'small' | 'full'; span?: number; widgets: unknown[] }> }).columns ?? []).map((col) => buildColumn(col)))
    : Promise.resolve([]);

  const [headWidgets, flatWidgets, columns] = await Promise.all([headPromise, flatWidgetsPromise, columnsPromise]);

  const hideHeaders = page['hide-headers'] === true;
  if (hideHeaders) {
    const forceHide = (widgets: WidgetPayload[]) => {
      for (const w of widgets) {
        w.config = { ...w.config, 'hide-header': true };
        if (w.widgets) forceHide(w.widgets);
      }
    };
    forceHide(headWidgets);
    forceHide(flatWidgets);
    for (const col of columns) forceHide(col.widgets);
  }

  return {
    slug: page.slug,
    name: page.name,
    width: page.width ?? 'default',
    ...(page['center-vertically'] !== undefined ? { 'center-vertically': page['center-vertically'] } : {}),
    ...(page['show-mobile-header'] !== undefined ? { 'show-mobile-header': page['show-mobile-header'] } : {}),
    ...(hideHeaders ? { 'hide-headers': true as const, hideHeaders: true as const } : {}),
    tiling: page.tiling ?? 'columns',
    minColumnWidth: page['min-column-width'] ?? 300,
    headWidgets,
    columns,
    ...(isFlat ? { widgets: flatWidgets, gridColumns: (page as Record<string, unknown>)['grid-columns'] as number | undefined ?? 12, gridRowHeight: (page as Record<string, unknown>)['grid-row-height'] as number | undefined ?? 96 } : {}),
  };
}

export interface StreamChunk {
  path: string;
  payload: WidgetPayload;
}

/**
 * Progressive version of buildPagePayload: yields each top-level widget as
 * soon as its fetch settles so the server can flush NDJSON early. Slow
 * widgets (e.g. videos) don't block head widgets or fast columns.
 */
export async function* streamPagePayload(
  page: Page & { slug: string },
  ctx: WidgetFetchContext,
): AsyncGenerator<StreamChunk> {
  type Pending = Promise<StreamChunk>;
  const pending: Pending[] = [];

  const push = (path: string, cachePath: string, widget: Record<string, unknown>) => {
    pending.push(
      fetchWidget(ctx, page.slug, cachePath, widget).then((payload) => ({ path, payload })),
    );
  };

  if (Array.isArray(page['head-widgets'])) {
    page['head-widgets'].forEach((w, i) => {
      push(`headWidgets[${i}]`, `h:${i}`, isRecord(w) ? w : { type: 'unknown' });
    });
  }
  const flat = (page as { widgets?: unknown[] }).widgets;
  if (Array.isArray(flat)) {
    flat.forEach((w, i) => push(`widgets[${i}]`, `w:${i}`, isRecord(w) ? w : { type: 'unknown' }));
  } else {
    const cols = (page as { columns?: Array<{ size: 'small' | 'full'; widgets: unknown[] }> }).columns ?? [];
    cols.forEach((col, ci) => {
      col.widgets.forEach((w, wi) => {
        const cachePath = `${col.size === 'small' ? 's' : 'f'}:${wi}`;
        push(`columns[${ci}].widgets[${wi}]`, cachePath, isRecord(w) ? w : { type: 'unknown' });
      });
    });
  }

  // Flush in settlement order (head widgets typically win). Use indexed race
  // so the winner's position can be removed without re-creating promises.
  const remaining = pending.slice();
  while (remaining.length) {
    const raced = await Promise.race(
      remaining.map((p, idx) => p.then((v) => ({ v, idx }))),
    );
    yield raced.v;
    remaining.splice(raced.idx, 1);
  }
}
