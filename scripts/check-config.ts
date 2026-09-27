#!/usr/bin/env bun
/**
 * bun run check-config [path]
 *
 * Validates a config file: prints the numbered YAML source, then every error
 * with a hint, plus did-you-mean suggestions for typo'd widget types.
 * Exit 0 when valid, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/server/config';
import { widgetMeta } from '../src/shared/widgets';
import { TYPE_ALIAS_KEYS } from '../src/shared/widgets/aliases';
import { ConfigSchema } from '../src/shared/config';
import { z } from 'zod';

const configPath = process.argv[2] ?? process.env.GLIMPSE_CONFIG ?? './config.yml';
// Aliases are folded by the schema before it discriminates, so the linter must
// accept them too — otherwise it flags a valid glance type as unknown.
const knownTypes = [...Object.keys(widgetMeta), ...TYPE_ALIAS_KEYS];

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length];
}

function suggest(unknown: string): string | null {
  let best: string | null = null;
  let bestDist = 4;
  for (const t of knownTypes) {
    const dist = levenshtein(unknown, t);
    if (dist < bestDist) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

/** Static hint table for common failure modes. */
const HINTS: Record<string, string> = {
  'environment variable': 'hint: export the variable, or use ${VAR:-fallback} for a default',
  'duplicate page slug': 'hint: give each page a unique `slug:` (or a unique `name:`)',
  'at least one full column': 'hint: give at least one column `size: full`',
  'more than two full columns': 'hint: at most two `size: full` columns per page (max 3 columns total)',
  'cannot contain': 'hint: a `group` widget cannot nest `group` or `split-column` children',
  'circular $include': 'hint: break the include cycle so files form a DAG',
  'column requires': 'hint: every column needs `size: small|full` or an explicit `span:`',
  'Page needs': 'hint: every page needs `columns:` or a flat `widgets:` list',
};

/** Widget options Glimpse used to read a credential from. The config is served
 * to the browser verbatim, so a key in the file was a key in the page — the
 * fields moved to the environment and are named here so an existing config
 * says what to do instead of silently losing its credential. Keyed by widget
 * type, then option; nested frames inherit the widget's type. */
const REMOVED_CREDENTIALS: Record<string, Record<string, string>> = {
  immich: { 'api-key': 'IMMICH_API_KEY' },
  jellyfin: { 'api-key': 'JELLYFIN_API_KEY' },
  qbittorrent: { username: 'QBITTORRENT_USERNAME', password: 'QBITTORRENT_PASSWORD' },
  transmission: { username: 'TRANSMISSION_USERNAME', password: 'TRANSMISSION_PASSWORD' },
  tailscale: { 'api-key': 'TS_API_KEY' },
  'home-assistant': { token: 'HA_TOKEN' },
  'ai-quota': { token: 'the provider env var (CODEX_TOKEN, ANTHROPIC_API_KEY, …) or tokenFile' },
  'contribution-graph': { token: 'nothing — the widget fetches public pages anonymously' },
  'dns-stats': {
    token: 'PIHOLE_TOKEN or TECHNITIUM_TOKEN',
    password: 'PIHOLE_PASSWORD or ADGUARD_PASSWORD',
    username: 'ADGUARD_USERNAME',
  },
  reddit: { 'app-auth': 'REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET' },
  releases: { token: 'GITHUB_TOKEN', 'gitlab-token': 'GITLAB_TOKEN' },
  repository: { token: 'GITHUB_TOKEN' },
};

function removedCredential(type: string | undefined, key: string): string | undefined {
  return type === undefined ? undefined : REMOVED_CREDENTIALS[type]?.[key];
}

function hintFor(error: string): string | null {
  if (/discriminator|did you mean/i.test(error)) {
    return 'hint: check the widget `type:` spelling (see suggestions below)';
  }
  for (const [k, v] of Object.entries(HINTS)) {
    if (error.includes(k)) return v;
  }
  return null;
}

let raw: string | null = null;
try {
  raw = readFileSync(configPath, 'utf8');
} catch (e) {
  console.error(`cannot read ${configPath}: ${(e as Error).message}`);
  process.exit(1);
}

const result = loadConfig(configPath);

// Did-you-mean: flag unknown `type:` only inside widgets lists — other
// `type:` keys (server-stats `servers:`, monitor `sites:`) are not widgets.
const srcLines = raw.split('\n');
const indentOf = (s: string): number => s.match(/^ */)?.[0].length ?? 0;
function insideWidgetsList(idx: number): boolean {
  let indent = indentOf(srcLines[idx]);
  for (let j = idx - 1; j >= 0; j--) {
    const t = srcLines[j];
    if (/^\s*(#|$)/.test(t)) continue;
    const ind = indentOf(t);
    if (ind >= indent) continue;
    const km = /^\s*-?\s*([\w$-]+)\s*:/.exec(t);
    if (!km) {
      indent = ind;
      continue;
    }
    if (km[1] === 'widgets' || km[1] === 'head-widgets') return true;
    if (km[1] === 'pages' || km[1] === 'columns') {
      indent = ind;
      continue;
    }
    return false;
  }
  return false;
}
const unknownTypes: Array<{ line: number; value: string; guess: string | null }> = [];
srcLines.forEach((text, i) => {
  const m = /type\s*:\s*['"]?([\w-]+)['"]?/.exec(text);
  if (m && !knownTypes.includes(m[1]) && insideWidgetsList(i)) {
    unknownTypes.push({ line: i + 1, value: m[1], guess: suggest(m[1]) });
  }
});

// ── unsupported options ────────────────────────────────────────────────────
// The one class of config error zod cannot report: a widget's object strips
// unknown keys, so a glance option Glimpse never implemented parses clean and
// renders nothing. `.strict()` is not the fix — glance declares ~38 top-level
// config keys and ConfigSchema admits 2, so strict mode would reject every real
// config. So the shape is diffed here instead, against the raw source, where a
// line number still exists. Top level is exempt for the reason above.

type Obj = { shape: Record<string, z.ZodType>; def?: { catchall?: unknown } };

/** Peels the wrappers a schema is dressed in: optional, default, nullable,
 * the alias-folding pipe, and the lazy back-reference group/split-column use
 * for their own children. */
function unwrap(s: z.ZodType): z.ZodType {
  let cur = s;
  for (;;) {
    const def = (cur.def ?? {}) as { innerType?: z.ZodType; out?: z.ZodType; getter?: () => z.ZodType };
    const next = cur instanceof z.ZodLazy ? def.getter?.() : cur instanceof z.ZodPipe ? def.out : def.innerType;
    if (next === undefined) return cur;
    cur = next;
  }
}

interface Frame {
  /** Indent of the lines that are this frame's direct children. */
  indent: number;
  /** Keys accepted here, or null while a widget item's `type:` is unread. */
  shape: Record<string, z.ZodType> | null;
  obj: Obj | null;
  /** A widget list: the shape only arrives once the item's `type:` names it. */
  widget: boolean;
  /** False where unknown keys are legal (the root) or unknowable. */
  warn: boolean;
  /** Widget type, for the message; inherited by nested frames. */
  type?: string;
  /** Path of the object this frame describes; `[]` marks a list. */
  path: string;
  /** List items seen, for the `[n]` index. */
  seen: number;
}

function unsupportedOptions(lines: string[]): string[] {
  const out: string[] = [];
  const stack: Frame[] = [
    { indent: -1, shape: ConfigSchema.shape, obj: ConfigSchema, widget: false, warn: false, path: '', seen: 0 },
  ];
  let blockIndent = -1; // inside a `|`/`>` scalar, whose body is not config

  lines.forEach((text, i) => {
    const indent = indentOf(text);
    if (blockIndent >= 0) {
      if (indent > blockIndent || /^\s*(#|$)/.test(text)) return;
      blockIndent = -1;
    }
    if (/^\s*(#|$)/.test(text)) return;
    const isItem = /^\s*-\s+/.test(text);
    const m = /^([\w$-]+)\s*:(.*)$/.exec(isItem ? text.replace(/^\s*-\s+/, '') : text.trimStart());
    if (!m) return;
    const [, key, rest] = m;

    while (stack.length > 1 && stack[stack.length - 1]!.indent > indent) stack.pop();
    let frame = stack[stack.length - 1]!;
    let base = frame.path;
    if (isItem) {
      const index = frame.seen++;
      base = frame.path.endsWith('[]') ? `${frame.path.slice(0, -2)}[${index}]` : frame.path;
      // The item's keys sit one step in from its dash.
      stack.push({
        indent: indent + 2,
        obj: frame.widget ? null : frame.obj,
        shape: frame.widget ? null : frame.obj?.shape ?? null,
        widget: frame.widget,
        warn: !frame.widget && frame.obj?.def?.catchall === undefined,
        path: base,
        seen: 0,
        type: frame.type,
      });
      frame = stack[stack.length - 1]!;
    }
    if (frame.widget) {
      if (key !== 'type') {
        if (!frame.shape) return;
      } else {
        const type = rest.trim().replace(/^['"]|['"]$/g, '');
        const schema = widgetMeta[type as keyof typeof widgetMeta]?.schema as Obj | undefined;
        frame.obj = schema ?? null;
        frame.shape = schema?.shape ?? null;
        frame.type = type;
        frame.warn = schema !== undefined;
        return;
      }
    }

    const keyPath = base === '' ? key : `${base}.${key}`;
    const known = !frame.shape || key in frame.shape;
    const env = known ? undefined : removedCredential(frame.type, key);
    // Checked before the generic "unsupported option": a removed credential
    // needs the env var name, not a shrug. Warned even on a `.loose()` frame,
    // where the generic pass stays quiet because nothing is stripped there.
    if (env) {
      out.push(
        `line ${i + 1}: "${key}" is no longer read from the config${frame.type ? ` of the ${frame.type} widget` : ''} (${keyPath}) — secrets must not live in a file the server hands to the browser; set ${env} in the environment instead`,
      );
    } else if (frame.warn && frame.shape && !known) {
      out.push(
        `line ${i + 1}: "${key}" is not a supported option${frame.type ? ` of the ${frame.type} widget` : ''} (${keyPath}) — Glimpse ignores it`,
      );
    }
    if (/^[|>][-+]?\d*$/.test(rest.trim())) {
      blockIndent = indent;
      return;
    }

    const member = frame.shape?.[key];
    if (member === undefined) return;
    const inner = unwrap(member);
    const list = inner instanceof z.ZodArray;
    const value = list ? unwrap((inner as z.ZodArray).element) : inner;
    // A record's keys are whatever the config calls them, so its frame takes
    // the key's own path and each child hangs off it.
    const record = value instanceof z.ZodRecord ? unwrap(value.def.valueType) : null;
    const resolved = record ?? value;
    let child: Obj | null = null;
    let isUnion = false;
    if (resolved instanceof z.ZodDiscriminatedUnion) {
      isUnion = true;
    } else if (resolved instanceof z.ZodObject) {
      child = resolved;
    } else if (resolved instanceof z.ZodUnion) {
      // `search-engine:` is string-or-object; its object form is only
      // unambiguous when the union names exactly one.
      const objects = resolved.options
        .map(unwrap)
        .filter((o): o is z.ZodObject => o instanceof z.ZodObject);
      if (objects.length === 1) child = objects[0]!;
    }
    if (!isUnion && !child) return;
    // Two YAML spellings: children indented under the key, or a list whose
    // dashes sit at the key's own indent. The next line says which.
    const next = lines[i + 1];
    const nextIndent = next === undefined ? indent + 2 : indentOf(next);
    const childIndent = next !== undefined && /^\s*-\s/.test(next) && nextIndent <= indent ? nextIndent : indent + 2;
    stack.push({
      indent: childIndent,
      obj: child,
      shape: child?.shape ?? null,
      widget: isUnion,
      // `.loose()` objects keep unknown keys instead of stripping them, and a
      // record's keys are the config's own naming, not options — neither has
      // anything ignored to report.
      warn: !isUnion && !record && child?.def?.catchall === undefined,
      path: list || isUnion ? `${keyPath}[]` : keyPath,
      seen: 0,
      type: frame.type,
    });
  });
  return out;
}

const unsupported = unsupportedOptions(srcLines);

// One warning list, printed on both exits: an unsupported option is worth
// saying whether or not something else is also wrong.
const warnings = [
  ...(result.warnings ?? []).map((w) => `warning: ${w}`),
  ...unknownTypes.map(
    (u) =>
      `warning: line ${u.line}: unknown widget type "${u.value}"${u.guess ? ` — did you mean "${u.guess}"?` : ''}`,
  ),
  ...unsupported.map((u) => `warning: ${u}`),
];

if (result.ok) {
  console.log(`${configPath}: OK (${result.config!.pages.length} page(s))`);
  for (const w of warnings) console.log(w);
  process.exit(0);
}

console.log(`--- ${configPath} ---`);
raw.split('\n').forEach((text, i) => {
  console.log(`${String(i + 1).padStart(4)} | ${text}`);
});
console.log('--- errors ---');
for (const e of result.errors ?? []) {
  console.log(`error: ${e}`);
  const h = hintFor(e);
  if (h) console.log(`  ${h}`);
}
for (const w of warnings) console.log(w);
process.exit(1);
