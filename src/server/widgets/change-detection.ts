import { changeDetectionSchema } from '../../shared/widgets/change-detection';
import type { ChangeDetectionData, ChangeDetectionItem } from '../../shared/widgets/payloads';
import { fetchText } from './http';
import { registerWidget } from './registry';

/** How long a watched URL's content hash survives in the shared cache. */
const HASH_TTL_MS = 30 * 24 * 3_600_000;

const SNIPPET_LEN = 200;

interface StoredHash {
  hash: string;
  changedAt: string | null;
}

/** FNV-1a hex — no deps, deterministic across runtimes. */
export function hashContent(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Strip tags/scripts/styles, collapse whitespace — the comparable text. */
export function toComparableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Narrow `html` to the first element matching a simple selector
 * (`tag`, `#id`, or `.class`). Anything else falls back to the full page,
 * so an exotic selector degrades to whole-page watching instead of failing.
 */
export function extractBySelector(html: string, selector: string): string {
  const sel = selector.trim();
  let inner: string | null = null;
  if (sel.startsWith('#')) {
    const id = sel.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    inner = html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))?.[1] ?? null;
  } else if (sel.startsWith('.')) {
    const cls = sel.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    inner = html.match(new RegExp(`<[^>]+\\bclass=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))?.[1] ?? null;
  } else if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(sel)) {
    inner = html.match(new RegExp(`<${sel}[^>]*>([\\s\\S]*?)<\\/${sel}>`, 'i'))?.[1] ?? null;
  }
  return toComparableText(inner ?? html);
}

registerWidget('change-detection', async (ctx, config): Promise<ChangeDetectionData> => {
  const cfg = changeDetectionSchema.parse(config);
  const settled = await Promise.allSettled(
    cfg.urls.map(async (url): Promise<ChangeDetectionItem> => {
      const key = `change-detection:${url}:${cfg.selector ?? ''}`;
      const prev = ctx.cache.get<StoredHash>(key);
      let html: string;
      try {
        html = await fetchText(ctx, url);
      } catch {
        // Per-site failure must not clear the stored hash or break siblings.
        return { url, changed: false, changedAt: prev?.changedAt ?? null };
      }
      const text = cfg.selector ? extractBySelector(html, cfg.selector) : toComparableText(html);
      const hash = hashContent(text);
      if (!prev) {
        ctx.cache.set(key, { hash, changedAt: null } satisfies StoredHash, HASH_TTL_MS);
        return { url, changed: false, changedAt: null };
      }
      if (hash === prev.hash) {
        return { url, changed: false, changedAt: prev.changedAt };
      }
      const changedAt = new Date().toISOString();
      ctx.cache.set(key, { hash, changedAt } satisfies StoredHash, HASH_TTL_MS);
      const item: ChangeDetectionItem = { url, changed: true, changedAt };
      const snippet = text.slice(0, SNIPPET_LEN).trim();
      if (snippet) item.diffSnippet = snippet;
      return item;
    }),
  );
  const items: ChangeDetectionData = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') items.push(r.value);
  }
  return items;
});
