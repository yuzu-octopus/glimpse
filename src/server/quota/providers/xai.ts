import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: XAI_API_KEY — Bearer from https://console.x.ai/
export async function fetchXaiUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.x.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return { provider: 'xai', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
