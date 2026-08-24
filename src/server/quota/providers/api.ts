import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';

// shared helper for API-token providers: Bearer token fetch with sanitizeUrl via fetchJson
export async function apiFetchJson<T>(ctx: WidgetFetchContext, url: string, token: string): Promise<T> {
  return fetchJson<T>(ctx, url, { headers: { Authorization: `Bearer ${token}` } });
}
