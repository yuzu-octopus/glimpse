import { z } from 'zod';
import { bookmarksSchema } from './bookmarks';
import { clockSchema } from './clock';
import { calendarSchema } from './calendar';
import {
  hackerNewsSchema,
  redditSchema,
  releasesSchema,
  rssSchema,
  weatherSchema,
} from './feeds';
import { groupSchema, setWidgetSchemaRef, splitColumnSchema } from './group';
import { htmlSchema, iframeSchema } from './iframe';
import { searchSchema } from './search';
import { sharedWidgetFields } from './shared';
import { todoSchema } from './todo';

/** Loose placeholder for widgets whose strict schema lands in a later step. */
function looseSchema<T extends string>(type: T) {
  return z.object({ type: z.literal(type), ...sharedWidgetFields }).loose();
}

const schemaEntries = [
  bookmarksSchema,
  searchSchema,
  clockSchema,
  calendarSchema,
  todoSchema,
  iframeSchema,
  htmlSchema,
  rssSchema,
  hackerNewsSchema,
  redditSchema,
  groupSchema,
  splitColumnSchema,
  releasesSchema,
  weatherSchema,
  looseSchema('lobsters'),
  looseSchema('videos'),
  looseSchema('markets'),
  looseSchema('monitor'),
  looseSchema('custom-api'),
  looseSchema('repository'),
  looseSchema('twitch-channels'),
  looseSchema('twitch-top-games'),
] as const;

/** Public widget type union, derived from the schema entries. */
export type WidgetType = (typeof schemaEntries)[number]['shape']['type']['value'];

export const WidgetSchema = z.discriminatedUnion('type', schemaEntries);
export type WidgetConfig = z.infer<typeof WidgetSchema>;

// Wire the recursive container reference now that the union exists.
setWidgetSchemaRef(WidgetSchema);
