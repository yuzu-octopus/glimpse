import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { initConfig, getConfig } from './config';
import { Singleflight, TtlCache } from './cache';
import { buildPagePayload } from './api';
import type { WidgetFetchContext } from './widgets/registry';
import './widgets'; // side-effect: registers all widget fetchers

const CONFIG_PATH =
  process.argv[2] ?? process.env.GLIMPSE_CONFIG ?? './config.yml';
const PORT = Number(process.env.GLIMPSE_PORT ?? 3000);

// Version from package.json (relative to repo root; the server runs with
// cwd = repo root). Never fatal — the About pane falls back to 'unknown'.
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
const VERSION = readVersion();

const ctx: WidgetFetchContext = {
  fetch: globalThis.fetch.bind(globalThis),
  env: process.env as Record<string, string>,
  cache: new TtlCache(),
  singleflight: new Singleflight(),
};

initConfig(CONFIG_PATH, (r) => {
  if (r.ok) ctx.cache.clear(); // only on success: failed reload keeps last-good config, keys stay valid
  console.log(
    r.ok ? '[config] reloaded' : `[config] reload failed: ${r.errors?.join('; ')}`,
  );
});
console.log(`[glimpse] watching ${CONFIG_PATH}`);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

// Custom CSS file is re-read on every /api/theme hit; cache it with a 5s
// re-stat + mtime check so edits still appear quickly without per-request reads.
const THEME_CSS_CHECK_MS = 5_000;
let themeCssCache: { file: string; mtimeMs: number; content: string } | null = null;
let themeCssCheckedAt = 0;

function readThemeCss(cssFile: string): string | null {
  const now = Date.now();
  if (
    themeCssCache?.file === cssFile &&
    now - themeCssCheckedAt < THEME_CSS_CHECK_MS
  ) {
    return themeCssCache.content;
  }
  const path = resolve(dirname(CONFIG_PATH), cssFile);
  try {
    const { mtimeMs } = statSync(path);
    if (themeCssCache?.file === cssFile && themeCssCache.mtimeMs === mtimeMs) {
      themeCssCheckedAt = now;
      return themeCssCache.content;
    }
    const content = readFileSync(path, 'utf8');
    themeCssCache = { file: cssFile, mtimeMs, content };
    themeCssCheckedAt = now;
    return content;
  } catch (e) {
    console.log(`[glimpse] cannot read custom css file: ${(e as Error).message}`);
    themeCssCache = null;
    themeCssCheckedAt = now;
    return null;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Serve the built SPA from dist/ (production path; dev uses Vite). */
function serveDist(pathname: string): Response {
  const dist = join(process.cwd(), 'dist');
  if (!existsSync(dist)) return json({ error: 'not found' }, 404);

  let filePath: string;
  try {
    filePath = normalize(
      join(dist, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))),
    );
  } catch {
    // malformed percent-encoding (e.g. %zz) → SPA fallback, same as unknown path
    filePath = join(dist, 'index.html');
  }
  if (!filePath.startsWith(dist + sep) && filePath !== dist + sep + 'index.html') {
    return json({ error: 'forbidden' }, 403);
  }
  if (!existsSync(filePath) || !filePath.startsWith(dist + sep)) {
    filePath = join(dist, 'index.html'); // SPA fallback
  }
  const body = readFileSync(filePath);
  const headers: Record<string, string> = {
    'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
  };
  const rel = filePath.slice(dist.length + 1);
  if (rel.startsWith('assets/')) {
    // Vite hashes these filenames — cache forever.
    headers['cache-control'] = 'public, max-age=31536000, immutable';
  } else if (
    rel === 'index.html' ||
    rel.endsWith('.webmanifest') ||
    rel === 'sw.js' ||
    rel === 'registerSW.js' ||
    rel === 'favicon.svg' ||
    rel === 'icon.svg'
  ) {
    headers['cache-control'] = 'no-cache'; // unhashed root files: revalidate every load
  } else if (extname(filePath) === '.woff2') {
    headers['cache-control'] = 'public, max-age=86400'; // unhashed font, short cache
  }
  return new Response(body, { headers });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/api/config') {
      const r = getConfig();
      const headers = { 'cache-control': 'no-store' };
      return r.ok
        ? json(
            { ok: true, config: r.config, configPath: CONFIG_PATH, version: VERSION },
            200,
            headers,
          )
        : json({ ok: false, errors: r.errors }, 400, headers);
    }

    if (pathname === '/api/theme') {
      const r = getConfig();
      let customCss: string | null = null;
      const cssFile = r.ok && r.config ? r.config.theme?.['custom-css-file'] : undefined;
      if (cssFile) {
        customCss = readThemeCss(cssFile);
      }
      return json(
        {
          theme: r.ok && r.config ? r.config.theme ?? null : null,
          customCss,
        },
        200,
        { 'cache-control': 'public, max-age=60' },
      );
    }

    const pageMatch = /^\/api\/page\/([^/]+)$/.exec(pathname);
    if (pageMatch) {
      const r = getConfig();
      if (!r.ok) return json({ ok: false, errors: r.errors }, 400);
      const slug = decodeURIComponent(pageMatch[1]);
      const page = r.config?.pages.find((p) => p.slug === slug);
      if (!page) return json({ error: `page "${slug}" not found` }, 404);
      const payload = await buildPagePayload(page, ctx);
      return json(payload, 200, {
        'cache-control': 'public, max-age=30, stale-while-revalidate=300',
      });
    }

    return serveDist(pathname);
  },
});

console.log(`[glimpse] server listening on http://localhost:${server.port}`);
