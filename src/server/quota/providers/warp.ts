import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: WARP_API_KEY — Bearer from https://app.warp.dev/settings
export async function fetchWarpUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await fetchJson<{ remaining: number; total: number }>(ctx, 'https://app.warp.dev/api/v1/limits', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  return { provider: 'warp', windows: [{ label: 'requests', usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100), windowMinutes: 0, resetsAt: 0 }], balance: data.remaining, raw: data };
}
