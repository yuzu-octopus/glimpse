import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: LITELLM_API_KEY — Bearer for LiteLLM proxy https://litellm.ai/
export async function fetchLitellmUsage(auth: { token: string; baseUrl?: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const base = auth.baseUrl ?? 'https://api.litellm.ai';
  const data = await fetchJson<{ remaining: number; total: number }>(ctx, `${base}/balance`, { headers: { Authorization: `Bearer ${auth.token}` } });
  return { provider: 'litellm', windows: [{ label: 'credits', usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.remaining, raw: data };
}
