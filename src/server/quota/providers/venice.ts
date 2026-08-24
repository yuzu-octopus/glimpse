import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: VENICE_API_KEY — Bearer from https://venice.ai/keys
export async function fetchVeniceUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.venice.ai/api/v1/billing/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return { provider: 'venice', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
