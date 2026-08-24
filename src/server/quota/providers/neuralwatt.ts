import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: NEURALWATT_API_KEY — Bearer
export async function fetchNeuralwattUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.neuralwatt.ai/v1/credits', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return { provider: 'neuralwatt', windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
