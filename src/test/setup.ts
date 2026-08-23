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

// Vitest workers run on Node, so `Bun.YAML`/`Bun.XML` are absent there. Reuse
// the real Bun runtime when available so server code takes its fast path and
// the minimal fallbacks in config.ts/rss.ts stay dormant.
if (typeof Bun !== 'undefined') globalThis.Bun = Bun;

// Widget lazy chunks: suites that need synchronous registration can
// `await import('../client/widgets').then(m => m.preloadWidgets())` or
// `await __preloadWidgetsForTests()`. Default is lazy + Suspense fallback.
