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
      if (w.type === 'group' && w.widgets)
        return check(w.widgets as unknown as WidgetPayload[]);
      if (w.type === 'split-column' && w.widgets)
        return check(w.widgets as unknown as WidgetPayload[]);
      if ((LIVE_TYPES as Record<string, true>)[w.type as string]) return true;
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
 * Atomic swap via startTransition; AbortController per fetch.
 */
export function usePageData(slug: string): PageDataResult {
  const [data, setData] = useState<PagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidatingRaw, setIsValidatingRaw] = useState(true);
  const [isPending, startTransition] = useTransition();
  const isValidating = isPending || isValidatingRaw;
  const dataRef = useRef<PagePayload | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // core fetch — keeps stale data, flips isValidating, atomic swap
  const doFetch = async (signal: AbortSignal) => {
    if (signal.aborted) return;
    setIsValidatingRaw(true);
    try {
      const res = await fetch(`/api/page/${encodeURIComponent(slug)}`, { signal });
      if (signal.aborted) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as PagePayload;
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
        startTransition(() => {
          setError(e instanceof Error ? e.message : String(e));
        });
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
    // slug change: abort previous and clear via transition (atomic)
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    startTransition(() => {
      setData(null);
      setError(null);
    });
    dataRef.current = null;
    setIsValidatingRaw(true);

    void doFetch(ac.signal);

    const onFocus = () => {
      void validate();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      ac.abort();
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    if (!hasLiveWidget(data)) return;
    const id = window.setInterval(() => {
      void validate();
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const status: PageDataResult['status'] = error ? 'error' : data ? 'ready' : 'loading';
  return { data, error, isValidating, status, validate };
}
