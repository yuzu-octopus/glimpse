import { widgetMeta } from './index';
import type { WidgetType } from './index';
import type { Pref, SkeletonShape } from './shared';

/** Bento pref per widget type, derived from the co-located registry. */
export const PREFERRED_SIZES: Record<WidgetType, Pref> = Object.fromEntries(
  Object.entries(widgetMeta).map(([t, m]) => [t, m.pref]),
) as Record<WidgetType, Pref>;

/** Skeleton silhouette per widget type (WidgetChrome loading state). */
export const SKELETON_SHAPE: Record<string, SkeletonShape> = Object.fromEntries(
  Object.entries(widgetMeta).map(([t, m]) => [t, m.skeleton]),
);
