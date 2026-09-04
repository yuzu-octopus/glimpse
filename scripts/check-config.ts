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

const configPath = process.argv[2] ?? process.env.GLIMPSE_CONFIG ?? './config.yml';
const knownTypes = Object.keys(widgetMeta);

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

if (result.ok) {
  console.log(`${configPath}: OK (${result.config!.pages.length} page(s))`);
  for (const w of result.warnings ?? []) console.log(`warning: ${w}`);
  for (const u of unknownTypes) {
    console.log(
      `warning: line ${u.line}: unknown widget type "${u.value}"${u.guess ? ` — did you mean "${u.guess}"?` : ''}`,
    );
  }
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
for (const w of result.warnings ?? []) console.log(`warning: ${w}`);
for (const u of unknownTypes) {
  console.log(
    `line ${u.line}: unknown widget type "${u.value}"${u.guess ? ` — did you mean "${u.guess}"?` : ''}`,
  );
}
process.exit(1);
