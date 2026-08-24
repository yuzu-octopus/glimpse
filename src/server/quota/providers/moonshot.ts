import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: MOONSHOT_API_KEY — Bearer; host via MOONSHOT_API_HOST (api.moonshot.ai or api.moonshot.cn)
export async function fetchMoonshotUsage(
  auth: { token: string; baseUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const base = auth.baseUrl ?? 'https://api.moonshot.ai';
  const data = await fetchJson<{ data: { available_balance: number } }>(ctx, `${base}/v1/users/me/balance`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return {
    provider: 'moonshot',
    windows: [{ label: 'balance', usedPercent: 0, windowMinutes: 0, resetsAt: 0 }],
    balance: data.data.available_balance,
    raw: data,
  };
}
