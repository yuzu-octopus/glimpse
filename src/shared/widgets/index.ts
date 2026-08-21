import { z } from 'zod';
import { bookmarksSchema } from './bookmarks';
import { calendarSchema } from './calendar';
import { clockSchema } from './clock';
import { dockerContainersSchema } from './docker';
import { dnsStatsSchema } from './dns';
import {
  hackerNewsSchema,
  redditSchema,
  releasesSchema,
  rssSchema,
  weatherSchema,
} from './feeds';
import { groupSchema, setWidgetSchemaRef, splitColumnSchema } from './group';
import { htmlSchema, iframeSchema } from './iframe';
import {
  customApiSchema,
  lobstersSchema,
  marketsSchema,
  monitorSchema,
  repositorySchema,
  videosSchema,
} from './keyed';
import { searchSchema } from './search';
import { serverStatsSchema } from './server-stats';
import { systemStatsSchema } from './system-stats';
import { todoSchema } from './todo';
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
  lobstersSchema,
  videosSchema,
  marketsSchema,
  monitorSchema,
  customApiSchema,
  repositorySchema,
  systemStatsSchema,
  dockerContainersSchema,
  dnsStatsSchema,
  serverStatsSchema,
] as const;

/** Public widget type union, derived from the schema entries. */
export type WidgetType = (typeof schemaEntries)[number]['shape']['type']['value'];

export const WidgetSchema = z.discriminatedUnion('type', schemaEntries);
export type WidgetConfig = z.infer<typeof WidgetSchema>;

// Wire the recursive container reference now that the union exists.
setWidgetSchemaRef(WidgetSchema);
