/** Payload shapes shared between the Bun server and the React client. */

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
}

export interface PagePayload {
  slug: string;
  name: string;
  width: 'default' | 'slim' | 'wide';
  'center-vertically'?: boolean;
  headWidgets: WidgetPayload[];
  columns: ColumnPayload[];
}
