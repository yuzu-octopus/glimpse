/** Payload shapes shared between the Bun server and the React client. */

import type { ResolvedConfig } from './config';

/** /api/config success response. */
export interface ConfigResponse {
  ok: true;
  config: ResolvedConfig;
  /** Path of the loaded config file (CLI arg or GLIMPSE_CONFIG env). */
  configPath: string;
  /** package.json version; 'unknown' when it cannot be read. */
  version: string;
}

export interface WidgetPayload {
  type: string;
  config: Record<string, unknown>;
  data: unknown;
  error?: string;
  /** Children for container widgets (group, split-column). */
  widgets?: WidgetPayload[];
}

export interface ColumnPayload {
  size: 'small' | 'full';
  widgets: WidgetPayload[];
  /** Auto-tiling span hint (1-4); only set when the config declares it. */
  span?: number;
}
export interface PagePayload {
  slug: string;
  name: string;
  width: 'default' | 'slim' | 'wide';
  'center-vertically'?: boolean;
  'show-mobile-header'?: boolean;
  /** When true every widget header is hidden (page-level override for `hide-header`). */
  'hide-headers'?: boolean;
  /** CamelCase alias so clients can use `page.hideHeaders` or `page['hide-headers']`. */
  hideHeaders?: boolean;
/** 'columns' (default) = glance flex layout; 'auto' = balanced grid tiles;
 * 'collage' = dense bento grid with measured row spans.
 * Server always resolves a value (page.tiling ?? 'columns'). */
  tiling?: 'columns' | 'auto' | 'collage';
  /** Auto-mode minimum tile width in px. Server always resolves
   * (page['min-column-width'] ?? 300). */
  minColumnWidth?: number;
  headWidgets: WidgetPayload[];
  columns: ColumnPayload[];
  /** Pure bento — flat widgets when page declares `widgets` instead of `columns`. */
  widgets?: WidgetPayload[];
  gridColumns?: number;
  gridRowHeight?: number;
}
