import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: LLMPROXY_API_KEY — Bearer (self-hosted LLM proxy)
export async function fetchLlmproxyUsage(auth: { token: string; baseUrl?: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const base = auth.baseUrl ?? 'https://api.llmproxy.ai';
  const data = await fetchJson<{ balance: number; limit?: number }>(ctx, `${base}/v1/balance`, { headers: { Authorization: `Bearer ${auth.token}` } });
  const limit = data.limit ?? 100;
  return { provider: 'llmproxy', windows: [{ label: 'credits', usedPercent: Math.min(100, ((limit - data.balance) / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
