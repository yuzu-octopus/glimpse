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

  // Kick off head-widgets and columns together: neither depends on the other,
  // so awaiting head first would serialize the page's fetches.
  const headPromise = Array.isArray(page['head-widgets'])
    ? Promise.all(
        page['head-widgets'].map((w, i) =>
          fetchWidget(ctx, page.slug, `h:${i}`, isRecord(w) ? w : { type: 'unknown' }),
        ),
      )
    : Promise.resolve([]);

  const columnsPromise = Promise.all(page.columns.map((col) => buildColumn(col)));

  const [headWidgets, columns] = await Promise.all([headPromise, columnsPromise]);

  const hideHeaders = page['hide-headers'] === true;
  // When page hide-headers is set, force every widget's config hide-header so
  // even widgets that read cfg['hide-header'] directly are hidden, including
  // nested group/split-column children.
  if (hideHeaders) {
    const forceHide = (widgets: WidgetPayload[]) => {
      for (const w of widgets) {
        w.config = { ...w.config, 'hide-header': true };
        if (w.widgets) forceHide(w.widgets);
      }
    };
    forceHide(headWidgets);
    for (const col of columns) forceHide(col.widgets);
  }

  return {
    slug: page.slug,
    name: page.name,
    width: page.width ?? 'default',
    ...(page['center-vertically'] !== undefined
      ? { 'center-vertically': page['center-vertically'] }
      : {}),
    ...(page['show-mobile-header'] !== undefined
      ? { 'show-mobile-header': page['show-mobile-header'] }
      : {}),
    ...(hideHeaders ? { 'hide-headers': true as const, hideHeaders: true as const } : {}),
    // Tiling resolved server-side: defaults preserve glance behavior exactly.
    tiling: page.tiling ?? 'columns',
    minColumnWidth: page['min-column-width'] ?? 300,
    headWidgets,
    columns,
  };
}
