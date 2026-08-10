import type { ComponentType } from 'react';
import type { WidgetType } from '../../shared/config';

export interface WidgetComponentProps {
  config: Record<string, unknown>;
  data: unknown;
  error?: string;
}

export type WidgetComponent = ComponentType<WidgetComponentProps>;

/**
 * Client-side component registry, one entry per widget type. Each widget's
 * component module registers itself; the registry is keyed by the same
 * WidgetType union as the config schemas and server fetchers.
 */
export const clientWidgets = new Map<WidgetType, WidgetComponent>();

export function registerWidgetComponent(
  type: WidgetType,
  component: WidgetComponent,
): void {
  clientWidgets.set(type, component);
}
