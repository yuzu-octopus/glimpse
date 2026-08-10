import { useEffect, useRef, useState } from 'react';
import type { PagePayload } from '../../shared/api';

type PageDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: PagePayload }
  | { status: 'error'; error: string };

/** Fetches a page's widget data; refetches on window focus when stale. */
export function usePageData(slug: string): PageDataState {
  const [state, setState] = useState<PageDataState>({ status: 'loading' });
  const lastFetch = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ status: 'loading' });
      try {
        const res = await fetch(`/api/page/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as PagePayload;
        if (!cancelled) {
          lastFetch.current = Date.now();
          setState({ status: 'ready', data });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
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

  return state;
}
