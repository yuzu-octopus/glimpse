import { fetchJson } from '../widgets/http';
import type { WidgetFetchContext } from '../widgets/registry';
import type { UsageSnapshot } from '../../shared/widgets/quota-types';

type CostsResp = { data: { amount: { value: number } }[] };

export async function fetchOpenaiUsage(
  auth: { token: string; projectId?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const q = auth.projectId ? `?project_id=${encodeURIComponent(auth.projectId)}` : '';
  const costs = await fetchJson<CostsResp>(ctx, `https://api.openai.com/v1/organization/costs${q}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  // optional completions usage — best-effort, ignore failures to keep costs path passing
  try {
    await fetchJson<unknown>(ctx, `https://api.openai.com/v1/organization/usage/completions${q}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
  } catch {
    // ignore — costs is the primary signal
  }
  const total = costs.data.reduce((s, r) => s + (r.amount?.value ?? 0), 0);
  return {
    provider: 'openai',
    windows: [{ usedPercent: 0, windowMinutes: 0, resetsAt: 0, label: 'costs' }],
    balance: total,
    raw: costs,
  };
}
