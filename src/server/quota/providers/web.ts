import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';

// Generic helper for web-cookie providers.
// Cookie source: pasted from DevTools `Copy as cURL` or mounted tokenFile
// containing raw `Cookie:` header. Never logs cookie value; sanitizeUrl on error via fetchJson.
export async function webFetchJson<T>(ctx: WidgetFetchContext, url: string, cookie: string): Promise<T> {
  // CSRF token often lives inside Cookie as `csrftoken=…` (Django) or `csrfToken=…`
  const csrf = cookie.match(/csrftoken=([^;]+)/i)?.[1] ?? cookie.match(/csrfToken=([^;]+)/)?.[1];
  const headers: Record<string, string> = {
    Cookie: cookie,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Accept: 'application/json',
    Referer: new URL(url).origin + '/',
  };
  if (csrf) headers['X-CSRFTOKEN'] = csrf;
  return fetchJson<T>(ctx, url, { headers });
}
