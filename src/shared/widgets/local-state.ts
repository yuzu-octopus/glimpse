import { canonicalWidgetType } from './aliases';

/**
 * The widgets whose state lives in the browser rather than on the server:
 * notepad notes, todo items, and a running timer's remaining seconds. They
 * are the only widgets in the app that read or write localStorage, and the
 * only ones that need a per-instance identity.
 */
export const LOCAL_STATE_TYPES = ['notepad', 'todo', 'timer'] as const;
export type LocalStateType = (typeof LOCAL_STATE_TYPES)[number];

const LOCAL_STATE: Record<string, true> = Object.fromEntries(
  LOCAL_STATE_TYPES.map((t) => [t, true]),
) as Record<string, true>;

/** True for a config `type` that keeps its state in localStorage. Folds the
 * glance aliases first, because this runs before the schema does. */
export function hasLocalState(type: unknown): boolean {
  return typeof type === 'string' && LOCAL_STATE[canonicalWidgetType(type)] === true;
}

/**
 * The localStorage key for one instance.
 *
 * `id` is what separates two notepads on one page, or the same notepad on two
 * pages. Without it both resolve to `<type>.default` and share one blob, so
 * typing in either silently overwrites the other. The server derives a stable
 * per-instance id for every one of these widgets that does not name itself, so
 * a config with no `id:` anywhere still gets one blob per instance.
 */
export function localStateKey(type: string, id: string | undefined): string {
  return `glimpse.${type}.${id ?? 'default'}`;
}
