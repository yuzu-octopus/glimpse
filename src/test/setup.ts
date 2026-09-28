import { spawnSync } from 'node:child_process';

import '@testing-library/jest-dom/vitest';

// Node 22+ exposes an experimental `localStorage` global that is undefined
// without --localstorage-file and shadows jsdom's real Storage in vitest.
// Make bare `localStorage` work everywhere: prefer jsdom's instance, else a
// minimal in-memory Storage polyfill.
function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number): string | null {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

const storage: Storage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : makeStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

// core >= 0.6 SideNavItem calls useMediaQuery, which needs matchMedia. jsdom
// does not implement it, so an honest desktop default is required or every
// panel test dies in render before it asserts anything.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Vitest workers run on Node, so `Bun.YAML` is absent there — but the server is
// Bun-only and `Bun.YAML` is its one and only YAML parser. Install the real
// parser behind `__bunYamlParse` (a Bun subprocess, ~8ms per document) so tests
// parse YAML exactly the way production does, instead of a hand-rolled
// stand-in that can silently diverge. Deliberately not a fake `globalThis.Bun`:
// server code feature-detects `Bun` for `.file`/`.spawn`/`.XML`, and a partial
// fake would flip those paths on.
const PARSE_YAML =
  'try{process.stdout.write(JSON.stringify(Bun.YAML.parse(await Bun.stdin.text())))}catch(e){process.stderr.write(String(e));process.exit(1)}';
const g = globalThis as { __bunYamlParse?: (text: string) => unknown };
g.__bunYamlParse ??= (text: string): unknown => {
  const r = spawnSync('bun', ['-e', PARSE_YAML], { input: text, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.trim() || r.error?.message || 'bun YAML parse failed');
  return JSON.parse(r.stdout) as unknown;
};

// Widget chunks stay lazy behind the Suspense fallback. Component tests import
// the widget module directly, which registers it — no global preload needed.
