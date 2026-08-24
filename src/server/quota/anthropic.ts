import { fetchJson } from '../widgets/http';
import type { WidgetFetchContext } from '../widgets/registry';
import type { UsageSnapshot } from '../../shared/widgets/quota-types';

type CostReport = { data?: { amount?: { value: number } }[]; total?: number };

export async function fetchAnthropicUsage(
  auth: { token: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const data = await fetchJson<CostReport>(ctx, 'https://api.anthropic.com/v1/organizations/cost_report', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const balance =
    typeof data.total === 'number'
      ? data.total
      : Array.isArray(data.data)
        ? data.data.reduce((s, r) => s + (r.amount?.value ?? 0), 0)
        : undefined;
  return {
    provider: 'anthropic',
    windows: [{ usedPercent: 0, windowMinutes: 0, resetsAt: 0, label: 'cost_report' }],
    balance,
    raw: data,
  };
}
