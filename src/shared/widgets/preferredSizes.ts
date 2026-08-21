import type { WidgetType } from './index';

export type Pref = {
  preferredWidth: number | null;
  preferredHeight: number | null;
  resizable: boolean;
};

export const PREFERRED_SIZES: Record<WidgetType, Pref> = {
  clock: { preferredWidth: 300, preferredHeight: 200, resizable: false },
  weather: { preferredWidth: 300, preferredHeight: 280, resizable: false },
  calendar: { preferredWidth: 340, preferredHeight: 320, resizable: false },
  bookmarks: { preferredWidth: 300, preferredHeight: 240, resizable: false },
  search: { preferredWidth: 300, preferredHeight: 90, resizable: false },
  todo: { preferredWidth: 320, preferredHeight: 220, resizable: false },
  rss: { preferredWidth: null, preferredHeight: null, resizable: true },
  'hacker-news': { preferredWidth: null, preferredHeight: null, resizable: true },
  reddit: { preferredWidth: null, preferredHeight: null, resizable: true },
  lobsters: { preferredWidth: null, preferredHeight: null, resizable: true },
  releases: { preferredWidth: 360, preferredHeight: 260, resizable: false },
  videos: { preferredWidth: 380, preferredHeight: 220, resizable: false },
  markets: { preferredWidth: 340, preferredHeight: 220, resizable: false },
  monitor: { preferredWidth: 340, preferredHeight: 200, resizable: false },
  repository: { preferredWidth: 360, preferredHeight: 200, resizable: false },
  'custom-api': { preferredWidth: 340, preferredHeight: 200, resizable: false },
  iframe: { preferredWidth: 500, preferredHeight: 400, resizable: false },
  html: { preferredWidth: null, preferredHeight: 200, resizable: true },
  group: { preferredWidth: 340, preferredHeight: 320, resizable: false },
  'split-column': { preferredWidth: null, preferredHeight: 320, resizable: true },
  'system-stats': { preferredWidth: 340, preferredHeight: 220, resizable: false },
};

export function assertAllWidgetsCovered(widgetTypes: string[]): void {
  const missing = widgetTypes.filter((t) => !(t in PREFERRED_SIZES));
  if (missing.length > 0) {
    throw new Error(`PREFERRED_SIZES missing entries for: ${missing.join(', ')}`);
  }
}
