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
 *
 * Deliberately one shape: `(query, { engine, bangs, target, newTab })`. The old
 * positional `(query, engine, bangs)` form and the `search-engine`/`searchEngine`
 * /`new-tab`/`new_tab` key aliases were compatibility shims for call shapes that
 * never existed outside a test named "compat"; they are gone, not deprecated.
 */
export function resolveSearch(
  query: string,
  { engine, bangs, target, newTab }: ResolveSearchOpts = {},
): { url: string | null; target: string; bang?: Bang; rest: string } {
  const q = query.trim();
  if (!q) return { url: null, target: '_self', rest: '' };

  const { bang, rest } = matchBang(q, listBangs(bangs));
  if (!bang && rest.length === 0) return { url: null, target: '_self', rest };

  const url = (bang?.url ?? resolveEngine(engine)).replace('{QUERY}', encodeURIComponent(rest));
  return {
    url,
    // newTab: false is a hard "same tab" request and outranks a configured target.
    target: newTab === false ? '_self' : (target ?? '_blank'),
    bang,
    rest,
  };
}
