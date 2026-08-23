import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { PagePayload, WidgetPayload } from '../../shared/api';
import { LIVE_POLL_MS, LIVE_TYPES } from '../../shared/live';

export type PageDataResult = {
  data: PagePayload | null;
  error: string | null;
  isValidating: boolean;
  validate: () => Promise<void>;
  reload: (force?: boolean) => Promise<void>;
};

function getLiveKey(payload: PagePayload): 'none' | 'live' | 'homelab' {
  let hasLive = false;
  let hasHomelab = false;
  const check = (widgets: WidgetPayload[]): void => {
    for (const w of widgets) {
      const type = w.type;
      if (w.widgets) {
        check(w.widgets);
        if (type === 'group' || type === 'split-column') continue;
      }
      if (type === 'server-stats' || type === 'system-stats') hasHomelab = true;
      else if (LIVE_TYPES[type]) hasLive = true;
    }
  };
  if (payload.headWidgets) check(payload.headWidgets);
  for (const col of payload.columns) check(col.widgets);
  if (payload.widgets) check(payload.widgets);
  if (hasHomelab) return 'homelab';
  if (hasLive) return 'live';
  return 'none';
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

function applyChunk(base: PagePayload, path: string, payload: unknown): void {
  const w = payload as WidgetPayload;
  let m = /^columns\[(\d+)\]\.widgets\[(\d+)\]$/.exec(path);
  if (m) {
    const col = base.columns[Number(m[1])];
    if (col?.widgets[Number(m[2])]) col.widgets[Number(m[2])] = w;
    return;
  }
  m = /^headWidgets\[(\d+)\]$/.exec(path);
  if (m) {
    if (base.headWidgets[Number(m[1])]) base.headWidgets[Number(m[1])] = w;
    return;
  }
  m = /^widgets\[(\d+)\]$/.exec(path);
  if (m && base.widgets && base.widgets[Number(m[1])]) base.widgets[Number(m[1])] = w;
}

function reconcileWithCached(skeleton: PagePayload, cached: PagePayload): PagePayload {
  const base: PagePayload = skeleton;
  if (base.headWidgets && cached.headWidgets) {
    for (let i = 0; i < base.headWidgets.length; i++) {
      if (cached.headWidgets[i]) base.headWidgets[i] = cached.headWidgets[i];
    }
  }
  for (let ci = 0; ci < base.columns.length; ci++) {
    const sCol = base.columns[ci];
    const cCol = cached.columns[ci];
    if (!cCol) continue;
    for (let wi = 0; wi < sCol.widgets.length; wi++) {
      if (cCol.widgets[wi]) sCol.widgets[wi] = cCol.widgets[wi];
    }
  }
  if (base.widgets && cached.widgets) {
    for (let i = 0; i < base.widgets.length; i++) {
      if (cached.widgets[i]) base.widgets[i] = cached.widgets[i];
    }
  }
  return base;
}

async function fetchPage(
  slug: string,
  signal: AbortSignal,
  onProgress?: (p: PagePayload) => void,
  force = false,
): Promise<PagePayload> {
  if (!force && inflight.has(slug)) return inflight.get(slug)!;
  const p = (async () => {
    const internal = new AbortController();
    const qs = force ? '?stream&force=1' : '?stream';
    const res = await fetch(`/api/page/${encodeURIComponent(slug)}${qs}`, { signal: internal.signal });
    if (!res.ok) {
      const rawBody: unknown = await res.json().catch(() => ({}));
      let msg = `HTTP ${res.status}`;
      if (rawBody !== null && typeof rawBody === 'object' && 'error' in rawBody) {
        const maybe = rawBody.error;
        if (typeof maybe === 'string' && maybe) msg = maybe;
      }
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') ?? '';
    const isNdjson = ct.includes('ndjson');

    const cached = force ? null : getCached(slug);
    const cachedBase = cached ? structuredClone(cached) : null;
    let base: PagePayload | null = null;
    const skeletonOf = (chunk: { path?: string; payload?: unknown }): PagePayload | null => {
      if (chunk.path !== '$skeleton') return null;
      const candidate = chunk.payload;
      if (candidate === null || typeof candidate !== 'object') return null;
      if (!('columns' in candidate)) return null;
      return candidate as PagePayload;
    };

    const handleLine = (line: string): void => {
      if (!line.trim() || signal.aborted) return;
      let chunk: { path?: string; payload?: unknown };
      try {
        chunk = JSON.parse(line);
      } catch {
        return;
      }
      const skeleton = skeletonOf(chunk);
      if (skeleton) {
        if (!base) {
          base = cachedBase ? reconcileWithCached(skeleton, cachedBase) : skeleton;
          if (!signal.aborted) onProgress?.({ ...base });
        }
        return;
      }
      if (!base) {
        if (!cachedBase) return;
        base = cachedBase;
        if (!signal.aborted) onProgress?.({ ...base });
      }
      if (!chunk.path) return;
      applyChunk(base!, chunk.path!, chunk.payload);
      if (!signal.aborted) onProgress?.({ ...base! });
    };

    if (!isNdjson) {
      const text = await res.text();
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed !== null && typeof parsed === 'object' && 'columns' in parsed) {
          const payload = parsed as PagePayload;
          setCache(slug, payload);
          if (!signal.aborted) onProgress?.(payload);
          return payload;
        }
      } catch {
        // fall through to line-split fallback
      }
      for (const line of text.split('\n')) handleLine(line);
      if (!base) throw new Error('empty stream');
      setCache(slug, base);
      return base;
    }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    buf += dec.decode();
    handleLine(buf);
    if (!base) throw new Error('empty stream');
    setCache(slug, base);
    return base;
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
  const t = setTimeout(() => ac.abort(), 10000);
  fetchPage(slug, ac.signal)
    .catch(() => {})
    .finally(() => clearTimeout(t));
}

export function usePageData(slug: string): PageDataResult {
  const [data, setData] = useState<PagePayload | null>(() => getCached(slug));
  const [error, setError] = useState<string | null>(null);
  const [isValidatingRaw, setIsValidatingRaw] = useState(() => isStale(slug));
  const [isPending, startTransition] = useTransition();
  const isValidating = isPending || isValidatingRaw;
  const dataRef = useRef<PagePayload | null>(data);
  const abortRef = useRef<AbortController | null>(null);
  const validatingCountRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const doFetch = useCallback(
    async (signal: AbortSignal, force = false) => {
      if (signal.aborted) return;
      validatingCountRef.current += 1;
      setIsValidatingRaw(true);
      try {
        const onProgress = (progress: PagePayload) => {
          if (signal.aborted) return;
          dataRef.current = progress;
          setData(progress);
          setError(null);
        };
        const next = await fetchPage(slug, signal, onProgress, force);
        if (signal.aborted) return;
        startTransition(() => {
          dataRef.current = next;
          setData(next);
          setError(null);
        });
      } catch (e) {
        if ((e instanceof Error && e.name === 'AbortError') || signal.aborted) return;
        if (!dataRef.current) {
          const msg = e instanceof Error ? e.message : String(e);
          startTransition(() => setError(msg));
        }
      } finally {
        validatingCountRef.current = Math.max(0, validatingCountRef.current - 1);
        if (validatingCountRef.current === 0) setIsValidatingRaw(false);
      }
    },
    [slug],
  );

  const reload = useCallback(
    async (force = false) => {
      if (force) {
        dataRef.current = null;
        setData(null);
        setError(null);
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      await doFetch(ac.signal, force);
    },
    [doFetch],
  );

  const validate = useCallback(async () => {
    await reload(false);
  }, [reload]);

  useEffect(() => {
    const cached = getCached(slug);
    if (cached) {
      dataRef.current = cached;
      setData(cached);
      setError(null);
      setIsValidatingRaw(isStale(slug));
    } else {
      dataRef.current = null;
      setData(null);
      setError(null);
      setIsValidatingRaw(true);
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void doFetch(ac.signal, false);
    const onFocus = () => {
      if (isStale(slug)) void validate();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      ac.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [slug, doFetch, validate]);

  const liveKey = data ? getLiveKey(data) : 'none';

  useEffect(() => {
    if (liveKey === 'none') return;
    const interval = liveKey === 'homelab' ? 1000 : LIVE_POLL_MS;
    const id = window.setInterval(() => {
      void validate();
    }, interval);
    return () => window.clearInterval(id);
  }, [liveKey, validate]);

  return { data, error, isValidating, validate, reload };
}
