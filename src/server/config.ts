import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  ConfigSchema,
  type Config,
  type ResolvedConfig,
} from '../shared/config';
import { isRecord } from '../shared/is-record';
import { hasLocalState } from '../shared/widgets/local-state';

// `__bunYamlParse` is a test seam: Bun's own YAML parser, installed by
// src/test/setup.ts because vitest's Node workers have no Bun global. A
// hand-rolled second parser here is what used to sit in its place.
const testEnv = globalThis as { __bunYamlParse?: (text: string) => unknown };
const parseYaml = (text: string): unknown => {
  const bridge = testEnv.__bunYamlParse;
  return bridge ? bridge(text) : Bun.YAML.parse(text);
};

export interface LoadResult {
  ok: boolean;
  config?: ResolvedConfig;
  errors?: string[];
  /** Non-fatal notes, e.g. ignored keys in $included files. */
  warnings?: string[];
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
 * Recursively substitute ${VAR} and ${VAR:-fallback} (also ${VAR-fallback})
 * in every string value. `:-` falls back when unset or empty, `-` only when
 * unset; a missing var without fallback is an error (glance errors out on
 * missing env vars too). The ${secret:name} Docker-secrets syntax is
 * intentionally unsupported.
 */
function interpolateEnv(
  value: unknown,
  errors: string[],
  path: string,
): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-(.*?))?\}/g,
      (_m, name: string, fallback: string | undefined) => {
        const v = process.env[name];
        if (v !== undefined && v !== '') return v;
        if (fallback !== undefined) return fallback;
        if (v === undefined) {
          errors.push(`${path}: environment variable ${name} is not set`);
          return '';
        }
        return v;
      },
    );
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
  warnings: string[],
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
        const sub = loadYamlTree(incAbs, errors, warnings, files, seen);
        if (!sub) continue;
        const parentPages = Array.isArray(merged.pages) ? merged.pages : [];
        const subPages = Array.isArray(sub.pages) ? sub.pages : [];
        merged.pages = [...parentPages, ...subPages];
        if (sub['custom-css-file'] !== undefined) {
          merged['custom-css-file'] = sub['custom-css-file'];
        }
        for (const k of Object.keys(sub)) {
          if (k !== 'pages' && k !== 'custom-css-file') {
            warnings.push(
              `$include ${incAbs}: ignoring unsupported top-level key "${k}" (only pages and custom-css-file merge)`,
            );
          }
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

/** Per-instance identity for the widgets that keep their state in the browser.
 *
 * notepad, todo and timer key their localStorage on `glimpse.<type>.<id>`,
 * and every one of them allowed `id` to be omitted. Two bare notepads — on one
 * page or on two — then both resolved to `glimpse.notepad.default` and shared
 * a single blob, so typing in either silently overwrote the other. The schema
 * cannot make `id` required without refusing to load every existing config
 * that omits it, so identity is derived here, next to the slugs that already
 * give a page its name.
 *
 * The first instance of a type on a page is deliberately left alone: it has
 * always owned `default`, and re-keying it would orphan every note, task and
 * in-flight timer in every existing install. Only the instances that would
 * actually collide are given a new key.
 */
function deriveWidgetIds(pages: unknown): unknown {
  if (!Array.isArray(pages)) return pages;
  return pages.map((page) => {
    if (!isRecord(page) || typeof page.slug !== 'string') return page;
    const counts: Record<string, number> = {};
    const claim = (widget: unknown): unknown => {
      if (!isRecord(widget) || typeof widget.type !== 'string') return widget;
      if (typeof widget.id === 'string' && widget.id) return widget;
      if (!hasLocalState(widget.type)) return widget;
      const n = (counts[widget.type] ?? 0) + 1;
      counts[widget.type] = n;
      return n === 1 ? widget : { ...widget, id: `${page.slug}.${widget.type}.${n}` };
    };
    const walk = (widgets: unknown): unknown => {
      if (!Array.isArray(widgets)) return widgets;
      return widgets.map((w) => {
        const claimed = claim(w);
        return isRecord(claimed) && Array.isArray(claimed.widgets)
          ? { ...claimed, widgets: walk(claimed.widgets) }
          : claimed;
      });
    };
    return {
      ...page,
      'head-widgets': walk(page['head-widgets']),
      columns: Array.isArray(page.columns)
        ? (page.columns as unknown[]).map((col) =>
            isRecord(col) ? { ...col, widgets: walk(col.widgets) } : col,
          )
        : page.columns,
    };
  });
}

/** Load + validate a config file. Pure with respect to the filesystem. */
export function loadConfig(configPath: string): LoadResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileSet = new Set<string>();
  const doc = loadYamlTree(configPath, errors, warnings, fileSet, new Set());
  const files = [...fileSet];
  if (!doc) return { ok: false, errors, warnings, files };

  const interpolated = interpolateEnv(doc, errors, 'config') as Record<string, unknown>;

  validateColumns(interpolated.pages, errors);
  validateNesting(interpolated.pages, errors, 'config.pages');
  const identified = deriveWidgetIds(deriveSlugs(interpolated.pages, errors)) as unknown[];
  if (errors.length > 0) return { ok: false, errors, warnings, files };

  const parsed = ConfigSchema.safeParse({ ...interpolated, pages: identified });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.length ? `config.${issue.path.join('.')}` : 'config';
      errors.push(`${path}: ${issue.message}`);
    }
    return { ok: false, errors, warnings, files };
  }
  return { ok: true, config: parsed.data as ResolvedConfig, warnings, files };
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
function reloadConfig(configPath: string): LoadResult {
  const result = loadConfig(configPath);
  // A failed load's `files` is not the dependency set. loadYamlTree records a
  // file before reading it and steps over a broken include, so a broken
  // include still yields the whole list — but when the MAIN file is the one
  // that fails, `files` is just [main] and every include drops out. Watching
  // that list would uninstall their watchers for good: nothing reloads them.
  const watchFiles = result.ok ? result.files : [...new Set([...current.files, ...result.files])];
  if (result.ok || !current.ok) current = result;
  stopWatchers();
  for (const file of watchFiles) {
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
