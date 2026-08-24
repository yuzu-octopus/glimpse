import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: GROQ_API_KEY — Bearer from https://console.groq.com/keys
export async function fetchGroqcloudUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; limit?: number; used?: number }>(ctx, 'https://api.groq.com/openai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const limit = data.limit ?? 100;
  const used = data.used ?? limit - data.balance;
  return { provider: 'groqcloud', windows: [{ label: 'credits', usedPercent: Math.min(100, (used / limit) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
