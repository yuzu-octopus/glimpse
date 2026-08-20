import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  ConfigSchema,
  type Config,
  type ResolvedConfig,
} from '../shared/config';
import { isRecord } from './api';
import type { WidgetFetchContext } from './widgets/registry';

function warmPages(
  ctx: WidgetFetchContext,
  pages: ResolvedConfig['pages'],
): void {
  void import('./api').then(({ buildPagePayload }) => {
    for (const p of pages) void buildPagePayload(p as unknown as Parameters<typeof buildPagePayload>[0], ctx).catch(() => {});
  });
}

function pagesBySlug(pages: ResolvedConfig['pages']): Map<string, unknown> {
  return new Map(pages.map((p) => [p.slug, p]));
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
  files: string[],
  seen: Set<string>,
): Record<string, unknown> | null {
  const abs = resolve(filePath);
  if (seen.has(abs)) {
    errors.push(`circular $include detected: ${abs}`);
    return null;
  }
  seen.add(abs);
  files.push(abs);

  let raw: string;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (e) {
    errors.push(`cannot read config file ${abs}: ${(e as Error).message}`);
    return null;
  }

  let doc: unknown;
  try {
    doc = parse(raw);
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
}

/** Column invariant from glance docs: 1-2 full columns, up to 3 total. */
function validateColumns(pages: unknown, errors: string[]): void {
  if (!Array.isArray(pages)) return;
  pages.forEach((page, pi) => {
    if (!isRecord(page) || !Array.isArray(page.columns)) return;
    const fullCount = page.columns.filter(
      (c) => isRecord(c) && c.size === 'full',
    ).length;
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
  const files: string[] = [];
  const doc = loadYamlTree(configPath, errors, files, new Set());
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
  warmCtx?: WidgetFetchContext,
): LoadResult {
  const debounced = debounce(() => {
    const prev = current;
    const r = reloadConfig(configPath);
    if (warmCtx && r.ok && r.config) {
      if (prev.ok && prev.config) {
        const prevMap = pagesBySlug(prev.config.pages);
        const nextSlugs = new Set(r.config.pages.map((p) => p.slug));
        for (const p of r.config.pages) {
          const prevPage = prevMap.get(p.slug);
          if (!prevPage || JSON.stringify(prevPage) !== JSON.stringify(p)) {
            warmCtx.cache.deleteByPrefix(`${p.slug}:`);
          }
        }
        for (const slug of prevMap.keys()) if (!nextSlugs.has(slug as string)) warmCtx.cache.deleteByPrefix(`${slug as string}:`);
      }
      warmPages(warmCtx, r.config.pages);
    }
    onChange?.(r);
  }, 150);
  triggerReload = debounced;
  const initial = reloadConfig(configPath);
  if (warmCtx && initial.ok && initial.config) warmPages(warmCtx, initial.config.pages);
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
