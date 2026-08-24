import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: ZAI_API_KEY / Z_AI_API_KEY — Bearer (Z_AI_API_HOST override via baseUrl)
export async function fetchZaiUsage(auth: { token: string; baseUrl?: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const base = auth.baseUrl ?? 'https://api.z.ai';
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, `${base}/api/paas/v4/balance`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return { provider: 'zai', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
