import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: CHUTES_API_KEY — Bearer from https://chutes.ai/keys
export async function fetchChutesUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number; used?: number }>(ctx, 'https://api.chutes.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  const used = data.used ?? total - data.balance;
  return { provider: 'chutes', windows: [{ label: 'credits', usedPercent: Math.min(100, (used / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
