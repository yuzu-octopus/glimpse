import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: CLINE_API_KEY / ClinePass — Bearer from https://cline.ai/
export async function fetchClineUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ remaining: number; total: number }>(ctx, 'https://api.cline.ai/v1/usage', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return { provider: 'cline', windows: [{ label: 'credits', usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.remaining, raw: data };
}
