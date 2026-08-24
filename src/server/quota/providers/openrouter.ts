import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: OPENROUTER_API_KEY — paste from https://openrouter.ai/keys (Bearer)
export async function fetchOpenRouterUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ data: { credits: { total_credits: number; total_usage: number } } }>(
    ctx,
    'https://openrouter.ai/api/v1/key',
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
  const c = data.data.credits;
  const used = c.total_credits ? (c.total_usage / c.total_credits) * 100 : 0;
  return {
    provider: 'openrouter',
    windows: [{ label: 'credits', usedPercent: Math.min(100, used), windowMinutes: 0, resetsAt: 0 }],
    balance: c.total_credits - c.total_usage,
    raw: data,
  };
}
