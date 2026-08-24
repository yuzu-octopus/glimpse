import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: KILOCODE_API_KEY — Bearer (Kilo Code)
export async function fetchKilocodeUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.kilocode.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return { provider: 'kilocode', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
