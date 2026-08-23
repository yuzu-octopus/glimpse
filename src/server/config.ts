import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  ConfigSchema,
  type Config,
  type ResolvedConfig,
} from '../shared/config';
import { isRecord } from '../shared/is-record';

function parseYaml(text: string): unknown {
  const bunYaml = (globalThis as unknown as { Bun?: { YAML?: { parse(s: string): unknown } } }).Bun?.YAML;
  if (bunYaml) return bunYaml.parse(text);
  // Fallback for vitest/jsdom — minimal YAML parser for test fixtures (no external dep).
  // Handles mappings, sequences, scalars with 2-space indent. Not full YAML 1.2.
  // src/test/setup.ts polyfills globalThis.Bun when the Bun runtime is present,
  // so this only runs on plain Node without Bun.
  return fallbackYamlParse(text);
}

function fallbackYamlParse(text: string): unknown {
  // Unclosed flow collections are invalid YAML — reject before line parsing.
  for (const [open, close] of [['[', ']'], ['{', '}']] as const) {
    const opens = (text.match(new RegExp(`\\${open}`, 'g')) ?? []).length;
    const closes = (text.match(new RegExp(`\\${close}`, 'g')) ?? []).length;
    if (opens !== closes) throw new Error('unclosed flow collection');
  }
  const lines = text.split('\n');
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: unknown }> = [{ indent: -1, obj: root }];
  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.search(/\S/);
    const trimmed = rawLine.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).trim();
      const arr = parent as unknown[];
      if (!val) {
        const obj: Record<string, unknown> = {};
        arr.push(obj);
        stack.push({ indent, obj });
      } else if (val.includes(':') && !val.startsWith('[') && !val.startsWith('{')) {
        const colon = val.indexOf(':');
        const k = val.slice(0, colon).trim();
        const v = val.slice(colon + 1).trim();
        const obj: Record<string, unknown> = { [k]: parseScalar(v) };
        arr.push(obj);
        stack.push({ indent, obj });
      } else {
        arr.push(parseScalar(val));
      }
    } else if (trimmed.includes(':')) {
      const colon = trimmed.indexOf(':');
      const k = trimmed.slice(0, colon).trim().replace(/^['"]|['"]$/g, '');
      const v = trimmed.slice(colon + 1).trim();
      if (!v) {
        const idx = lines.indexOf(rawLine);
        const nextIdx = lines.findIndex((l, i) => i > idx && l.trim() && !l.trim().startsWith('#'));
        const next = nextIdx >= 0 ? lines[nextIdx].trim() : '';
        if (next.startsWith('- ')) {
          const arr: unknown[] = [];
          (parent as Record<string, unknown>)[k] = arr;
          stack.push({ indent, obj: arr });
        } else {
          const obj: Record<string, unknown> = {};
          (parent as Record<string, unknown>)[k] = obj;
          stack.push({ indent, obj });
        }
      } else if (v.startsWith('[{') || v.startsWith('{')) {
        (parent as Record<string, unknown>)[k] = parseFlow(v);
      } else {
        (parent as Record<string, unknown>)[k] = parseScalar(v);
      }
    }
  }
  return root;
}

/** Minimal flow-style parser for test fixtures like `[{ type: clock }]`. */
function parseFlow(v: string): unknown {
  const inner = v.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
  const parts: Array<Record<string, unknown>> = [];
  for (const m of inner.matchAll(/\{([^}]*)\}/g)) {
    const obj: Record<string, unknown> = {};
    for (const pair of m[1].split(',')) {
      const colon = pair.indexOf(':');
      if (colon === -1) continue;
      obj[pair.slice(0, colon).trim()] = parseScalar(pair.slice(colon + 1).trim());
    }
    parts.push(obj);
  }
  return parts;
}

function parseScalar(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

export interface LoadResult {
  ok: boolean;
  config?: ResolvedConfig;
  errors?: string[];
  /** Absolute paths of all files that were read (main + includes). */
  files: string[];
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'page';
}

/**
 * Recursively substitute ${ENV_VAR} in every string value. Missing vars are
 * recorded as errors (glance errors out on missing env vars too). The
 * ${secret:name} Docker-secrets syntax is intentionally unsupported.
 */
function interpolateEnv(
  value: unknown,
  errors: string[],
  path: string,
): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name: string) => {
      const v = process.env[name];
      if (v === undefined) {
        errors.push(`${path}: environment variable ${name} is not set`);
        return '';
      }
      return v;
    });
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => interpolateEnv(v, errors, `${path}[${i}]`));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolateEnv(v, errors, `${path}.${k}`);
    }
    return out;
  }
  return value;
}

/**
 * Load one YAML file, recursively processing $include directives (relative
 * paths resolve against the including file). Included pages are appended;
 * included theme keys override the parent's.
 */
function loadYamlTree(
  filePath: string,
  errors: string[],
  files: Set<string>,
  seen: Set<string>,
): Record<string, unknown> | null {
  const abs = resolve(filePath);
  if (seen.has(abs)) {
    errors.push(`circular $include detected: ${abs}`);
    return null;
  }
  seen.add(abs);
  try {
    files.add(abs);

    let raw: string;
    try {
      raw = readFileSync(abs, 'utf8');
    } catch (e) {
      errors.push(`cannot read config file ${abs}: ${(e as Error).message}`);
      return null;
    }
    let doc: unknown;
    try {
      doc = parseYaml(raw);
    } catch (e) {
      errors.push(`invalid YAML in ${abs}: ${(e as Error).message}`);
      return null;
    }
    if (doc === null || doc === undefined) return {};
    if (!isRecord(doc)) {
      errors.push(`config root must be a mapping in ${abs}`);
      return null;
    }

    const merged: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doc)) {
      if (k !== '$include') merged[k] = v;
    }

    const includes = doc['$include'];
    if (includes !== undefined) {
      const list = Array.isArray(includes) ? includes : [includes];
      for (const inc of list) {
        if (typeof inc !== 'string') {
          errors.push(`$include entries must be strings in ${abs}`);
          continue;
        }
        const incAbs = isAbsolute(inc) ? inc : resolve(dirname(abs), inc);
        if (files.has(incAbs) && !seen.has(incAbs)) continue;
        const sub = loadYamlTree(incAbs, errors, files, seen);
        if (!sub) continue;
        const parentPages = Array.isArray(merged.pages) ? merged.pages : [];
        const subPages = Array.isArray(sub.pages) ? sub.pages : [];
        merged.pages = [...parentPages, ...subPages];
        if (sub.theme !== undefined) {
          merged.theme = { ...(isRecord(merged.theme) ? merged.theme : {}), ...(isRecord(sub.theme) ? sub.theme : {}) };
        }
      }
    }
    return merged;
  } finally {
    seen.delete(abs);
  }
}

/** Column invariant from glance docs: 1-2 full columns, up to 3 total.
 * When every column declares an explicit `span`, the size invariant is
 * not applicable — the grid is explicitly sized. */
function validateColumns(pages: unknown, errors: string[]): void {
  if (!Array.isArray(pages)) return;
  pages.forEach((page, pi) => {
    if (!isRecord(page) || !Array.isArray(page.columns)) return;
    const cols = page.columns as unknown[];
    const usesExplicitSpan = cols.every((c) => isRecord(c) && typeof c.span === 'number');
    if (usesExplicitSpan) return;
    const fullCount = cols.filter((c) => isRecord(c) && c.size === 'full').length;
    if (fullCount < 1) {
      errors.push(`pages[${pi}]: must have at least one full column`);
    }
    if (fullCount > 2) {
      errors.push(`pages[${pi}]: cannot have more than two full columns`);
    }
  });
}

/** Group cannot contain group/split-column (docs/configuration.md §Group). */
function checkWidgetNesting(widgets: unknown, errors: string[], path: string): void {
  if (!Array.isArray(widgets)) return;
  for (const w of widgets) {
    if (!isRecord(w) || typeof w.type !== 'string') continue;
    if (w.type === 'group' && Array.isArray(w.widgets)) {
      for (const child of w.widgets as unknown[]) {
        if (isRecord(child) && (child.type === 'group' || child.type === 'split-column')) {
          errors.push(`${path}: a group widget cannot contain ${String(child.type)}`);
        }
      }
      checkWidgetNesting(w.widgets, errors, `${path}/group`);
    }
  }
}

function validateNesting(pages: unknown, errors: string[], path: string): void {
  if (!Array.isArray(pages)) return;
  pages.forEach((page, pi) => {
    if (!isRecord(page)) return;
    if (Array.isArray(page.columns)) {
      page.columns.forEach((col, ci) => {
        checkWidgetNesting(isRecord(col) ? col.widgets : undefined, errors, `${path}[${pi}].columns[${ci}]`);
      });
    }
    checkWidgetNesting(page['head-widgets'], errors, `${path}[${pi}].head-widgets`);
  });
}

function deriveSlugs(raw: unknown, errors: string[]): unknown {
  if (!Array.isArray(raw)) return raw;
  const seen = new Set<string>();
  return raw.map((page, i) => {
    if (!isRecord(page)) return page;
    const slug = typeof page.slug === 'string' && page.slug ? page.slug : slugify(String(page.name ?? `page-${i + 1}`));
    if (seen.has(slug)) {
      errors.push(`pages[${i}]: duplicate page slug "${slug}" (set unique slugs or page names)`);
    }
    seen.add(slug);
    return { ...page, slug };
  });
}

/** Load + validate a config file. Pure with respect to the filesystem. */
export function loadConfig(configPath: string): LoadResult {
  const errors: string[] = [];
  const fileSet = new Set<string>();
  const doc = loadYamlTree(configPath, errors, fileSet, new Set());
  const files = [...fileSet];
  if (!doc) return { ok: false, errors, files };

  const interpolated = interpolateEnv(doc, errors, 'config') as Record<string, unknown>;

  validateColumns(interpolated.pages, errors);
  validateNesting(interpolated.pages, errors, 'config.pages');
  const withSlugs = deriveSlugs(interpolated.pages, errors);
  if (errors.length > 0) return { ok: false, errors, files };

  const parsed = ConfigSchema.safeParse({ ...interpolated, pages: withSlugs });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.length ? `config.${issue.path.join('.')}` : 'config';
      errors.push(`${path}: ${issue.message}`);
    }
    return { ok: false, errors, files };
  }
  return { ok: true, config: parsed.data as ResolvedConfig, files };
}

// ---------------------------------------------------------------------------
// Auto-reload state (glance docs §Auto reload: reload on save, keep last-good
// config when the new one fails).
// ---------------------------------------------------------------------------

let current: LoadResult = { ok: false, errors: ['config not loaded'], files: [] };
let watchers: FSWatcher[] = [];

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Reload and re-register watchers (included files can appear/disappear). */
export function reloadConfig(configPath: string): LoadResult {
  const result = loadConfig(configPath);
  if (result.ok || !current.ok) current = result;
  stopWatchers();
  for (const file of result.files) {
    try {
      const w = watch(file, () => triggerReload());
      w.on('error', () => {});
      watchers.push(w);
    } catch {
      // file vanished between load and watch — next reload re-scans
    }
  }
  return result;
}

let triggerReload: () => void = () => {};

/** Start watching configPath; returns the initial load result. */
export function initConfig(
  configPath: string,
  onChange?: (r: LoadResult) => void,
): LoadResult {
  const debounced = debounce(() => {
    const r = reloadConfig(configPath);
    onChange?.(r);
  }, 150);
  triggerReload = debounced;
  const initial = reloadConfig(configPath);
  return initial;
}

function stopWatchers(): void {
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      // already closed
    }
  }
  watchers = [];
}

export function getConfig(): LoadResult {
  return current;
}

export type { Config };
