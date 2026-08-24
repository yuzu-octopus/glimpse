import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: CODEBUFF_API_KEY — Bearer from https://codebuff.com/keys
export async function fetchCodebuffUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ credits_remaining: number; credits_total: number }>(ctx, 'https://api.codebuff.com/v1/usage', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return { provider: 'codebuff', windows: [{ label: 'credits', usedPercent: Math.min(100, ((data.credits_total - data.credits_remaining) / data.credits_total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.credits_remaining, raw: data };
}
