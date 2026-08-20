import type { SearchConfig } from '../../../shared/widgets/search';
import { bangs as heliumBangs } from '../../../shared/widgets/bangs';

export type Bang = SearchConfig['bangs'][number];

export const ENGINE_PRESETS: Record<string, string> = {
  duckduckgo: 'https://duckduckgo.com/?q={QUERY}',
  google: 'https://www.google.com/search?q={QUERY}',
  bing: 'https://www.bing.com/search?q={QUERY}',
  perplexity: 'https://www.perplexity.ai/search?q={QUERY}',
  kagi: 'https://kagi.com/search?q={QUERY}',
  startpage: 'https://www.startpage.com/search?q={QUERY}',
};

/** glance search-engine: preset name, custom URL with {QUERY}, or object. */
export function resolveEngine(engine: SearchConfig['search-engine']): string {
  if (typeof engine === 'object' && engine) return engine.url;
  if (typeof engine === 'string') {
    const preset = ENGINE_PRESETS[engine.toLowerCase()];
    if (preset) return preset;
    if (engine.includes('{QUERY}')) return engine;
  }
  return ENGINE_PRESETS.duckduckgo;
}

/** return the effective bangs list: custom overrides when non-empty, else helium. */
export function listBangs(custom?: Bang[]): Bang[] {
  if (custom?.length) return custom;
  return heliumBangs as unknown as Bang[];
}

function matchBang(
  query: string,
  bangs: Bang[],
): { bang?: Bang; rest: string } {
  const firstWord = query.split(/\s+/)[0];
  if (!firstWord || bangs.length === 0) return { rest: query };
  const needle = firstWord.replace(/^!/, '').toLowerCase();
  const bang =
    needle &&
    bangs.find((b) => b.shortcut.replace(/^!/, '').toLowerCase() === needle);
  if (!bang) return { rest: query };
  return { bang, rest: query.slice(firstWord.length).trim() };
}

export interface ResolveSearchOpts {
  engine?: SearchConfig['search-engine'];
  bangs?: Bang[];
  target?: string;
  newTab?: boolean;
}

/**
 * Pure resolver: turn a raw query + bangs/engine config into a {url,target}.
 * Returns {url: null} for empty/whitespace input (caller should no-op).
 * Supports both `resolveSearch('gh query')` (defaults: helium + duckduckgo)
 * and `resolveSearch('gh query', { engine, bangs, target, newTab })`.
 * Also accepts positional `(query, engine, bangs)` for backward compat.
 */
export function resolveSearch(
  query: string,
  optsOrEngine?: ResolveSearchOpts | SearchConfig['search-engine'] | Bang[],
  maybeBangs?: Bang[],
): { url: string | null; target: string; bang?: Bang; rest: string } {
  let engine: SearchConfig['search-engine'] | undefined;
  let bangs: Bang[] | undefined;
  let target: string | undefined;
  let newTab: boolean | undefined;

  if (Array.isArray(optsOrEngine)) {
    bangs = optsOrEngine;
  } else if (
    typeof optsOrEngine === 'string' ||
    (optsOrEngine !== null &&
      typeof optsOrEngine === 'object' &&
      'url' in (optsOrEngine as Record<string, unknown>))
  ) {
    engine = optsOrEngine as SearchConfig['search-engine'];
    bangs = maybeBangs;
  } else if (optsOrEngine && typeof optsOrEngine === 'object') {
    const o = optsOrEngine as ResolveSearchOpts & Record<string, unknown>;
    // allow both `engine` and `search-engine` keys
    engine =
      (o.engine as SearchConfig['search-engine']) ??
      (o['search-engine'] as SearchConfig['search-engine']) ??
      (o['searchEngine'] as SearchConfig['search-engine']);
    bangs = o.bangs as Bang[] | undefined;
    target = o.target as string | undefined;
    // newTab may be passed as `newTab` or `new-tab` or `new_tab`
    newTab =
      (o.newTab as boolean | undefined) ??
      (o['new-tab'] as boolean | undefined) ??
      (o['new_tab'] as boolean | undefined);
    // also allow target key `target`
    if (!target && typeof o['target'] === 'string') target = o['target'] as string;
  }

  const effectiveBangs = listBangs(bangs);
  const engineUrl = resolveEngine(engine);
  const q = query.trim();
  if (!q) return { url: null, target: '_self', rest: '' };

  const { bang, rest } = matchBang(q, effectiveBangs);
  if (!bang && rest.length === 0) return { url: null, target: '_self', rest };

  const url = (bang?.url ?? engineUrl).replace('{QUERY}', encodeURIComponent(rest));
  const resolvedTarget = newTab ? (target ?? '_blank') : '_self';
  return { url, target: resolvedTarget, bang, rest };
}
