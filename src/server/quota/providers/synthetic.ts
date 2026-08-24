import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: SYNTHETIC_API_KEY — Bearer from https://synthetic.new/keys
export async function fetchSyntheticUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total: number; used?: number }>(ctx, 'https://api.synthetic.new/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total || data.balance + (data.used ?? 0) || 100;
  const used = data.used ?? total - data.balance;
  return { provider: 'synthetic', windows: [{ label: 'credits', usedPercent: Math.min(100, (used / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
