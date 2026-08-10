import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { TextInput } from '@astryxdesign/core';
import { searchSchema, type SearchConfig } from '../../../shared/widgets/search';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';

const ENGINE_PRESETS: Record<string, string> = {
  duckduckgo: 'https://duckduckgo.com/?q={QUERY}',
  google: 'https://www.google.com/search?q={QUERY}',
  bing: 'https://www.bing.com/search?q={QUERY}',
  perplexity: 'https://www.perplexity.ai/search?q={QUERY}',
  kagi: 'https://kagi.com/search?q={QUERY}',
  startpage: 'https://www.startpage.com/search?q={QUERY}',
};

/** glance search-engine: preset name, custom URL with {QUERY}, or object. */
function resolveEngine(engine: SearchConfig['search-engine']): string {
  if (typeof engine === 'object' && engine) return engine.url;
  if (typeof engine === 'string') {
    const preset = ENGINE_PRESETS[engine.toLowerCase()];
    if (preset) return preset;
    if (engine.includes('{QUERY}')) return engine;
  }
  return ENGINE_PRESETS.duckduckgo;
}

type Bang = SearchConfig['bangs'][number];

/** bang match: shortcut (leading '!' optional) equals the first word of the query. */
function matchBang(
  query: string,
  bangs: Bang[],
): { bang?: Bang; rest: string } {
  const firstWord = query.split(/\s+/)[0];
  if (!firstWord || bangs.length === 0) return { rest: query };
  const needle = firstWord.replace(/^!/, '').toLowerCase();
  const bang =
    needle &&
    bangs.find(
      (b) => b.shortcut.replace(/^!/, '').toLowerCase() === needle,
    );
  if (!bang) return { rest: query };
  return { bang, rest: query.slice(firstWord.length).trim() };
}

export function Search({ config }: WidgetComponentProps) {
  const cfg = searchSchema.parse(config);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef('');
  const engineUrl = resolveEngine(cfg['search-engine']);
  const shortcut = cfg.key ?? 's';

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable);
      if (
        e.key === shortcut &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const search = (raw: string, newTab: boolean) => {
    const q = raw.trim();
    if (!q) return;
    const { bang, rest } = matchBang(q, cfg.bangs);
    if (!bang && rest.length === 0) return;
    const url = (bang?.url ?? engineUrl).replace(
      '{QUERY}',
      encodeURIComponent(rest),
    );
    if (newTab) {
      window.open(url, cfg.target ?? '_blank', 'noopener,noreferrer');
    } else {
      window.open(url, '_self');
    }
    lastQueryRef.current = rest;
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowUp' && lastQueryRef.current) {
      e.preventDefault();
      setQuery(lastQueryRef.current);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // new-tab swaps Enter/Ctrl+Enter (glance parity)
      const newTab = cfg['new-tab'] === true ? !e.ctrlKey : e.ctrlKey;
      search(query, newTab);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    search(query, cfg['new-tab'] === true);
  };

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
    >
      <form onSubmit={submit}>
        <TextInput
          ref={inputRef}
          label="Search"
          isLabelHidden
          value={query}
          onChange={setQuery}
          onKeyDown={onKeyDown}
          placeholder={cfg.placeholder ?? `Search the web… (press ${shortcut})`}
          hasAutoFocus={cfg.autofocus === true}
          hasClear
        />
      </form>
    </WidgetChrome>
  );
}

registerWidgetComponent('search', Search);
