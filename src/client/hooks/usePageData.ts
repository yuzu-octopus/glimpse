import { useEffect, useRef, useState } from 'react';
import type { PagePayload, WidgetPayload } from '../../shared/api';

export type PageDataResult = {
  data: PagePayload | null;
  error: string | null;
  isValidating: boolean;
  status: 'loading' | 'ready' | 'error';
};

const LIVE_TYPES = new Set(['clock', 'weather', 'markets', 'monitor']);
const LIVE_POLL_MS = 30_000;

function hasLiveWidget(payload: PagePayload): boolean {
  const check = (widgets: WidgetPayload[]): boolean => {
    for (const w of widgets) {
      if (LIVE_TYPES.has(w.type)) return true;
      if (w.widgets && check(w.widgets)) return true;
    }
    return false;
  };
  if (payload.headWidgets && check(payload.headWidgets)) return true;
  for (const col of payload.columns) {
    if (check(col.widgets)) return true;
  }
  return false;
}

/** Fetches a page's widget data; refetches on window focus when stale.
 * Live pages (clock/weather/markets/monitor) poll every 30s; static pages
 * are reload-only (no interval) and rely on server's 1h TTL.
 * Stale-while-revalidate: polling keeps previous data and sets
 * isValidating true until the new fetch resolves — no skeleton flicker.
 */
export function usePageData(slug: string): PageDataResult {
  const [data, setData] = useState<PagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const lastFetch = useRef(0);
  const dataRef = useRef<PagePayload | null>(null);
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    // Reset for new slug: clear stale from previous page
    setData(null);
    setError(null);
    setIsValidating(true);
    dataRef.current = null;

    const load = async () => {
      // Keep stale data, just mark validating
      setIsValidating(true);
      try {
        const res = await fetch(`/api/page/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const next = (await res.json()) as PagePayload;
        if (!cancelled) {
          lastFetch.current = Date.now();
          dataRef.current = next;
          setData(next);
          setError(null);
          setIsValidating(false);
        }
      } catch (e) {
        if (!cancelled) {
          // Keep stale data on revalidation error; only surface error if no data
          if (!dataRef.current) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setIsValidating(false);
        }
      }
    };

    loadRef.current = () => {
      void load();
    };
    void load();

    const onFocus = () => {
      if (Date.now() - lastFetch.current > 30_000) void load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    if (!hasLiveWidget(data)) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastFetch.current >= LIVE_POLL_MS) {
        loadRef.current();
      }
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [data]);

  const status: PageDataResult['status'] = error ? 'error' : data ? 'ready' : 'loading';
  return { data, error, isValidating, status };
}
