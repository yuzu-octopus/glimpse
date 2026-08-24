import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: WorkosCursorSessionToken=…; orpgy=…; csrftoken=…  (from cursor.sh DevTools → Copy as cURL)
// Endpoint: GET https://cursor.sh/api/dashboard/usage
export async function fetchCursorUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ usage?: { usedPercent: number; resetAt: number }; usedPercent?: number; resetAt?: number }>(
    ctx,
    'https://cursor.sh/api/dashboard/usage',
    auth.token,
  );
  const used = data.usage?.usedPercent ?? data.usedPercent ?? 0;
  const reset = data.usage?.resetAt ?? data.resetAt ?? 0;
  return { provider: 'cursor', windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: reset }], raw: data };
}
