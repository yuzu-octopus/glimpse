import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { initConfig, getConfig } from './config';
import { Singleflight, TtlCache } from './cache';
import { buildPagePayload } from './api';
import type { WidgetFetchContext } from './widgets/registry';
import './widgets'; // side-effect: registers all widget fetchers

const CONFIG_PATH =
  process.argv[2] ?? process.env.GLIMPSE_CONFIG ?? './config.yml';
const PORT = Number(process.env.GLIMPSE_PORT ?? 3000);

const ctx: WidgetFetchContext = {
  fetch: globalThis.fetch.bind(globalThis),
  env: process.env as Record<string, string>,
  cache: new TtlCache(),
  singleflight: new Singleflight(),
};

initConfig(CONFIG_PATH, (r) => {
  console.log(
    r.ok ? '[config] reloaded' : `[config] reload failed: ${r.errors?.join('; ')}`,
  );
});
console.log(`[glimpse] watching ${CONFIG_PATH}`);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

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

  let filePath = normalize(
    join(dist, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))),
  );
  if (!filePath.startsWith(dist + sep) && filePath !== dist + sep + 'index.html') {
    return json({ error: 'forbidden' }, 403);
  }
  if (!existsSync(filePath) || !filePath.startsWith(dist + sep)) {
    filePath = join(dist, 'index.html'); // SPA fallback
  }
  const body = readFileSync(filePath);
  return new Response(body, {
    headers: { 'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/api/config') {
      const r = getConfig();
      return r.ok ? json({ ok: true, config: r.config }) : json({ ok: false, errors: r.errors }, 400);
    }

    if (pathname === '/api/theme') {
      const r = getConfig();
      return json({
        theme: r.ok && r.config ? r.config.theme ?? null : null,
        customCss: null, // populated once theming lands (step 5)
        presets: [], // populated once theming lands (step 5)
      });
    }

    const pageMatch = /^\/api\/page\/([^/]+)$/.exec(pathname);
    if (pageMatch) {
      const r = getConfig();
      if (!r.ok) return json({ ok: false, errors: r.errors }, 400);
      const slug = decodeURIComponent(pageMatch[1]);
      const page = r.config?.pages.find((p) => p.slug === slug);
      if (!page) return json({ error: `page "${slug}" not found` }, 404);
      const payload = await buildPagePayload(page, ctx);
      return json(payload);
    }

    return serveDist(pathname);
  },
});

console.log(`[glimpse] server listening on http://localhost:${server.port}`);
