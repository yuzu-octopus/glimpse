import type { Page } from '../shared/config';
import type { PagePayload, WidgetPayload } from '../shared/api';
import { parseCacheDuration } from './cache';
import {
  serverWidgets,
  type WidgetFetchContext,
} from './widgets/registry';

function isRecord(v: unknown): v is Record<string, unknown> {
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
  const ttlMs = parseCacheDuration(
    typeof widget.cache === 'string' ? widget.cache : undefined,
  );

  const cached = ctx.cache.get<WidgetPayload['data']>(cacheKey);
  if (cached !== undefined) {
    payload.data = cached;
    return payload;
  }

  try {
    const data = await ctx.singleflight.run(cacheKey, () =>
      fetcher(ctx, widget),
    );
    // Cache successes only: a broken endpoint retries on the next request.
    ctx.cache.set(cacheKey, data, ttlMs);
    payload.data = data;
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
  const buildColumn = (col: { size: 'small' | 'full'; widgets: unknown[] }) =>
    Promise.all(
      col.widgets.map((w, i) =>
        fetchWidget(ctx, page.slug, `${col.size === 'small' ? 's' : 'f'}:${i}`, isRecord(w) ? w : { type: 'unknown' }),
      ),
    );

  // Kick off head-widgets and columns together: neither depends on the other,
  // so awaiting head first would serialize the page's fetches.
  const headPromise = Array.isArray(page['head-widgets'])
    ? Promise.all(
        page['head-widgets'].map((w, i) =>
          fetchWidget(ctx, page.slug, `h:${i}`, isRecord(w) ? w : { type: 'unknown' }),
        ),
      )
    : Promise.resolve([]);

  const columnsPromise = Promise.all(
    page.columns.map((col) =>
      buildColumn(col).then((widgets) => ({
        size: col.size,
        widgets,
      })),
    ),
  );

  const [headWidgets, columns] = await Promise.all([headPromise, columnsPromise]);

  return {
    slug: page.slug,
    name: page.name,
    width: page.width ?? 'default',
    ...(page['center-vertically'] !== undefined
      ? { 'center-vertically': page['center-vertically'] }
      : {}),
    ...(page['hide-desktop-navigation'] !== undefined
      ? { 'hide-desktop-navigation': page['hide-desktop-navigation'] }
      : {}),
    ...(page['show-mobile-header'] !== undefined
      ? { 'show-mobile-header': page['show-mobile-header'] }
      : {}),
    ...(page['desktop-navigation-width'] !== undefined
      ? { 'desktop-navigation-width': page['desktop-navigation-width'] }
      : {}),
    headWidgets,
    columns,
  };
}
