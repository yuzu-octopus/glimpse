import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TextInput } from '@astryxdesign/core';
import { searchSchema, type SearchConfig } from '../../../shared/widgets/search';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';

export const ENGINE_PRESETS: Record<string, string> = {
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

export function Search({ config }: WidgetComponentProps) {
  const cfg = searchSchema.parse(config);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const engineUrl = resolveEngine(cfg['search-engine']);
  const shortcut = cfg.key ?? 's';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const bang = /^!(\S+)\s*(.*)$/.exec(q);
    const match = bang
      ? cfg.bangs.find(
          (b) => b.shortcut.toLowerCase() === bang[1].toLowerCase(),
        )
      : undefined;
    const rest = bang ? (bang[2] ?? '') : q;
    const url = (match?.url ?? engineUrl).replace(
      '{QUERY}',
      encodeURIComponent(rest),
    );
    if (cfg['new-tab']) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(url, '_self');
    }
    setQuery('');
  };

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <form onSubmit={submit}>
        <TextInput
          ref={inputRef}
          label="Search"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder={cfg.placeholder ?? `Search the web… (press ${shortcut})`}
          hasAutoFocus={cfg.autofocus === true}
          hasClear
        />
      </form>
    </WidgetChrome>
  );
}

registerWidgetComponent('search', Search);
