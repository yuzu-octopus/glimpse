import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: CROF_API_KEY — Bearer from https://crof.ai/keys
export async function fetchCrofUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; limit?: number; used?: number }>(ctx, 'https://api.crof.ai/v1/billing', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const limit = data.limit ?? 100;
  const used = data.used ?? limit - data.balance;
  return { provider: 'crof', windows: [{ label: 'credits', usedPercent: Math.min(100, (used / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
