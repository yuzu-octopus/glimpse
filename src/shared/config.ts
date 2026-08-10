import { z } from 'zod';

/**
 * All widget types glimpse supports. Mirrors glance's widget catalog minus
 * the self-hosted infra widgets (docker, dns-stats, server-stats,
 * change-detection, extension, calendar-legacy) — see docs/configuration.md.
 * Each type's strict schema lives in src/shared/widgets/<type>.ts and is
 * registered below (initially the shared loose base, tightened as widgets
 * land).
 */
export const WIDGET_TYPES = [
  'bookmarks',
  'search',
  'clock',
  'calendar',
  'todo',
  'iframe',
  'html',
  'rss',
  'hacker-news',
  'reddit',
  'group',
  'split-column',
  'releases',
  'weather',
  'lobsters',
  'videos',
  'markets',
  'monitor',
  'custom-api',
  'repository',
  'twitch-channels',
  'twitch-top-games',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Shared props every widget accepts (glance "Shared Properties" table). */
const sharedProps = {
  type: z.literal('__type__'),
  title: z.string().optional(),
  'title-url': z.string().optional(),
  'hide-header': z.boolean().optional(),
  cache: z.string().optional(),
  'css-class': z.string().optional(),
} as const;

function baseSchema(type: WidgetType) {
  return z.object({ ...sharedProps, type: z.literal(type) }).passthrough();
}

/**
 * Per-widget config schemas, keyed by widget type. The discriminated union
 * over these validates widget configs at load time. Entries are swapped from
 * the loose base to strict per-widget schemas as each widget is implemented.
 * Declared as a const tuple so zod's discriminatedUnion accepts it (v4 wants
 * a tuple type); the lookup Record is derived from it.
 */
const schemaEntries = [
  baseSchema('bookmarks'),
  baseSchema('search'),
  baseSchema('clock'),
  baseSchema('calendar'),
  baseSchema('todo'),
  baseSchema('iframe'),
  baseSchema('html'),
  baseSchema('rss'),
  baseSchema('hacker-news'),
  baseSchema('reddit'),
  baseSchema('group'),
  baseSchema('split-column'),
  baseSchema('releases'),
  baseSchema('weather'),
  baseSchema('lobsters'),
  baseSchema('videos'),
  baseSchema('markets'),
  baseSchema('monitor'),
  baseSchema('custom-api'),
  baseSchema('repository'),
  baseSchema('twitch-channels'),
  baseSchema('twitch-top-games'),
] as const;

export const WidgetSchema = z.discriminatedUnion('type', schemaEntries);
export type WidgetConfig = z.infer<typeof WidgetSchema>;

export const ColumnSchema = z.object({
  size: z.enum(['small', 'full']),
  widgets: z.array(WidgetSchema),
});
export type Column = z.infer<typeof ColumnSchema>;

export const PageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  width: z.enum(['default', 'slim', 'wide']).optional(),
  'center-vertically': z.boolean().optional(),
  'head-widgets': z.array(WidgetSchema).optional(),
  columns: z.array(ColumnSchema).min(1).max(3),
});
export type Page = z.infer<typeof PageSchema>;

/** Glance HSL theme block (docs/configuration.md §Theme). */
export const ThemeConfigSchema = z
  .object({
    light: z.boolean().optional(),
    'background-color': z.string().optional(),
    'primary-color': z.string().optional(),
    'positive-color': z.string().optional(),
    'negative-color': z.string().optional(),
    'contrast-multiplier': z.number().optional(),
    'text-saturation-multiplier': z.number().optional(),
    'custom-css-file': z.string().optional(),
  })
  .passthrough();
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const ConfigSchema = z.object({
  pages: z.array(PageSchema).min(1),
  theme: ThemeConfigSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Config after slug derivation — every page has a unique slug. */
export type ResolvedConfig = Config & {
  pages: (Page & { slug: string })[];
};
