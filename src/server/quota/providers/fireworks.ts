import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: FIREWORKS_API_KEY — Bearer from https://fireworks.ai/api-keys
export async function fetchFireworksUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ credits: number; usage: number; limit?: number }>(ctx, 'https://api.fireworks.ai/billing/summary', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const limit = data.limit ?? data.credits ?? 100;
  return { provider: 'fireworks', windows: [{ label: 'credits', usedPercent: Math.min(100, (data.usage / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: (data.credits ?? limit) - data.usage, raw: data };
}
