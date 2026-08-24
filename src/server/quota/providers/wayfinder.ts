import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: WAYFINDER_API_KEY — Bearer
export async function fetchWayfinderUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ remaining: number; total: number }>(ctx, 'https://api.wayfinder.ai/v1/usage', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return { provider: 'wayfinder', windows: [{ label: 'credits', usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.remaining, raw: data };
}
