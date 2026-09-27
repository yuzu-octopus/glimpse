import { z } from 'zod';

/**
 * Glance type names that differ from ours. Glance's widget registry
 * (glance/internal/glance/widget.go) uses "to-do" and accepts "stocks" as a
 * markets alias; our canonical names stay "todo" and "markets" because every
 * widgetMeta row, server fetcher and client registration keys off them.
 * A glance config ported verbatim must still load, so map on the way in.
 */
const TYPE_ALIASES: Record<string, string> = {
  'to-do': 'todo',
  stocks: 'markets',
};

/** Rewrite alias `type` values anywhere in a config tree. Only plain objects
 * are rebuilt — a YAML scalar that arrived as a Date must survive as-is. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== 'object') return value;
  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto !== null && proto !== Object.prototype) return value;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) out[k] = normalize(v);
  const t = out['type'];
  if (typeof t === 'string' && TYPE_ALIASES[t]) out['type'] = TYPE_ALIASES[t];
  return out;
}

/** The widget union with glance type aliases folded to our canonical names. */
export const withTypeAliases = <T extends z.ZodType>(schema: T) =>
  z.preprocess(normalize, schema) as unknown as T;
