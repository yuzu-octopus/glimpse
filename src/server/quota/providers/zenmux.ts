import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: ZENMUX_API_KEY — Bearer
export async function fetchZenmuxUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; limit?: number }>(ctx, 'https://api.zenmux.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const limit = data.limit ?? 100;
  return { provider: 'zenmux', windows: [{ label: 'credits', usedPercent: Math.min(100, ((limit - data.balance) / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
