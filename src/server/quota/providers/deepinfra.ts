import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: DEEPINFRA_API_KEY — Bearer from https://deepinfra.com/dash/api_keys
export async function fetchDeepInfraUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; limit?: number; spent?: number }>(ctx, 'https://api.deepinfra.com/billing/checklist', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const limit = data.limit ?? 100;
  const spent = data.spent ?? limit - data.balance;
  return { provider: 'deepinfra', windows: [{ label: 'credits', usedPercent: Math.min(100, (spent / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
