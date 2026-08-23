import { useEffect, useRef, useState, useTransition } from 'react';
import type { PagePayload, WidgetPayload } from '../../shared/api';
import { LIVE_POLL_MS, LIVE_TYPES } from '../../shared/live';

export type PageDataResult = {
  data: PagePayload | null;
  error: string | null;
  isValidating: boolean;
  status: 'loading' | 'ready' | 'error';
  validate: () => Promise<void>;
};

function hasLiveWidget(payload: PagePayload): boolean {
  const check = (widgets: WidgetPayload[]): boolean => {
    for (const w of widgets) {
      if (w.type === 'group' && (w as any).widgets) return check((w as any).widgets as WidgetPayload[]);
      if (w.type === 'split-column' && (w as any).widgets) return check((w as any).widgets as WidgetPayload[]);
      if ((LIVE_TYPES as Record<string, true>)[w.type as string]) return true;
    }
    return false;
  };
  if (payload.headWidgets && check(payload.headWidgets)) return true;
  for (const col of payload.columns) if (check(col.widgets)) return true;
  return false;
}

const pageCache = new Map<string, { data: PagePayload; fetchedAt: number }>();
const inflight = new Map<string, Promise<PagePayload>>();
const STALE_MS = 30_000;
const GC_MS = 5 * 60_000;

export function __clearCacheForTests() {
  pageCache.clear();
  inflight.clear();
}

function setCache(slug: string, data: PagePayload) {
  pageCache.set(slug, { data, fetchedAt: Date.now() });
  setTimeout(() => {
    const entry = pageCache.get(slug);
    if (entry && Date.now() - entry.fetchedAt > GC_MS) pageCache.delete(slug);
  }, GC_MS + 1000);
}

function getCached(slug: string): PagePayload | null {
  const entry = pageCache.get(slug);
  if (!entry) return null;
  return entry.data;
}

function isStale(slug: string): boolean {
  const entry = pageCache.get(slug);
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > STALE_MS;
}

async function fetchPage(slug: string, signal: AbortSignal, onProgress?: (p: PagePayload) => void): Promise<PagePayload> {
  if (inflight.has(slug)) return inflight.get(slug)!;
  const p = (async () => {
    const res = await fetch(`/api/page/${encodeURIComponent(slug)}`, { signal });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as PagePayload;
    setCache(slug, data);
    onProgress?.(data);
    return data;
  })();
  inflight.set(slug, p);
  try {
    const result = await p;
    return result;
  } finally {
    inflight.delete(slug);
  }
}

export function prefetchPage(slug: string) {
  if (!isStale(slug) && pageCache.has(slug)) return;
  const ac = new AbortController();
  fetchPage(slug, ac.signal).catch(() => {});
  setTimeout(() => ac.abort(), 10000);
}

export function usePageData(slug: string): PageDataResult {
  const [data, setData] = useState<PagePayload | null>(() => getCached(slug));
  const [error, setError] = useState<string | null>(null);
  const [isValidatingRaw, setIsValidatingRaw] = useState(() => isStale(slug));
  const [isPending, startTransition] = useTransition();
  const isValidating = isPending || isValidatingRaw;
  const dataRef = useRef<PagePayload | null>(data);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const doFetch = async (signal: AbortSignal) => {
    if (signal.aborted) return;
    setIsValidatingRaw(true);
    try {
      const onProgress = (progress: PagePayload) => {
        if (signal.aborted) return;
        startTransition(() => {
          dataRef.current = progress;
          setData(progress);
          setError(null);
        });
      };
      const next = await fetchPage(slug, signal, onProgress);
      if (signal.aborted) return;
      startTransition(() => {
        dataRef.current = next;
        setData(next);
        setError(null);
      });
      if (!signal.aborted) setIsValidatingRaw(false);
    } catch (e) {
      if ((e as Error).name === 'AbortError' || signal.aborted) return;
      if (!dataRef.current) {
        startTransition(() => setError(e instanceof Error ? e.message : String(e)));
      }
      if (!signal.aborted) setIsValidatingRaw(false);
    }
  };

  const validate = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    await doFetch(ac.signal);
  };

  useEffect(() => {
    const cached = getCached(slug);
    if (cached) {
      dataRef.current = cached;
      setData(cached);
      setError(null);
      setIsValidatingRaw(isStale(slug));
    } else {
      setIsValidatingRaw(true);
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void doFetch(ac.signal);
    const onFocus = () => {
      if (isStale(slug)) void validate();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      ac.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    if (!hasLiveWidget(data)) return;
    const isHomelab = JSON.stringify(data).includes('"server-stats"') || JSON.stringify(data).includes('"system-stats"');
    const interval = isHomelab ? 1000 : LIVE_POLL_MS;
    const id = window.setInterval(() => {
      void validate();
    }, interval);
    return () => window.clearInterval(id);
  }, [data]);

  // Prefetching is handled via TopNav hover; idle prefetch disabled in tests to avoid mock interference

  const status: PageDataResult['status'] = error ? 'error' : data ? 'ready' : 'loading';
  return { data, error, isValidating, status, validate };
}
