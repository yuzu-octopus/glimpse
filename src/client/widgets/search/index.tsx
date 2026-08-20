import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { SearchConfig } from '../../../shared/widgets/search';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { listBangs, resolveSearch } from './engine';
import type { Bang } from './engine';
import styles from './search.module.css';

export function Search({ config }: WidgetComponentProps) {
  const cfg = config as unknown as SearchConfig;
  const bangs = listBangs(cfg.bangs as Bang[]);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef('');
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
    const { url, target, rest } = resolveSearch(raw, {
      engine: cfg['search-engine'],
      bangs,
      target: cfg.target,
      newTab,
    });
    if (!url) return;
    if (newTab) {
      window.open(url, target, 'noopener,noreferrer');
    } else {
      window.open(url, target, 'noopener,noreferrer');
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
      cssClass={[cfg['css-class'], styles.searchChrome].filter(Boolean).join(' ') || undefined}
    >
      <form className={styles.search} onSubmit={submit}>
        <span className={styles.iconContainer} aria-hidden="true">
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.5}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={cfg.placeholder ?? `Search the web… (press ${shortcut})`}
          autoComplete="off"
          autoFocus={cfg.autofocus === true}
        />
        <kbd
          className={styles.kbd}
          title={`Press [${shortcut.toUpperCase()}] to focus the search input`}
        >
          {shortcut.toUpperCase()}
        </kbd>
      </form>
    </WidgetChrome>
  );
}

registerWidgetComponent('search', Search);
