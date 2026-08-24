import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: DEEPSEEK_API_KEY — paste from https://platform.deepseek.com/api_keys (Bearer)
export async function fetchDeepSeekUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ balance_infos: { currency: string; total_balance: number; topped_up_balance: number }[] }>(
    ctx,
    'https://api.deepseek.com/user/balance',
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
  const usd = data.balance_infos.find((b) => b.currency === 'USD') ?? data.balance_infos[0];
  const bal = usd ? usd.total_balance : 0;
  return { provider: 'deepseek', windows: [{ label: 'balance', usedPercent: 0, windowMinutes: 0, resetsAt: 0 }], balance: bal, raw: data };
}
