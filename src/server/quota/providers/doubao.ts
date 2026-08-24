import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: DOUBAO_API_KEY / ARK_API_KEY — Bearer from https://console.volcengine.com/ark
export async function fetchDoubaoUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number; remaining?: number }>(ctx, 'https://ark.cn-beijing.volces.com/api/v3/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const bal = data.balance ?? data.remaining ?? 0;
  const total = data.total ?? 100;
  return { provider: 'doubao', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - bal) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: bal, raw: data };
}
