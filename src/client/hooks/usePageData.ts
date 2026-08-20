import { useEffect, useRef, useState } from 'react';
import type { PagePayload, WidgetPayload } from '../../shared/api';

type PageDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: PagePayload }
  | { status: 'error'; error: string };

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
 */
export function usePageData(slug: string): PageDataState {
  const [state, setState] = useState<PageDataState>({ status: 'loading' });
  const lastFetch = useRef(0);
  const loadRef = useRef<() => void>(() => {});

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
    if (state.status !== 'ready') return;
    if (!hasLiveWidget(state.data)) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastFetch.current >= LIVE_POLL_MS) {
        loadRef.current();
      }
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [state]);

  return state;
}
