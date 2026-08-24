import { fetchJson } from '../widgets/http';
import type { WidgetFetchContext } from '../widgets/registry';
import type { RateWindow, UsageSnapshot } from '../../shared/widgets/quota-types';

type Wham = {
  plan_type?: string;
  rate_limit?: {
    primary_window?: { used_percent: number; reset_at: number; limit_window_seconds: number };
    secondary_window?: { used_percent: number; reset_at: number; limit_window_seconds: number };
  };
};

export async function fetchCodexUsage(
  auth: { token: string; accountId?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    'User-Agent': 'Codex/1.0',
    Accept: 'application/json',
  };
  if (auth.accountId) headers['ChatGPT-Account-ID'] = auth.accountId;
  const data = await fetchJson<Wham>(ctx, 'https://chatgpt.com/backend-api/wham/usage', { headers });
  const windows: RateWindow[] = [];
  const p = data.rate_limit?.primary_window;
  if (p) windows.push({ usedPercent: p.used_percent, windowMinutes: p.limit_window_seconds / 60, resetsAt: p.reset_at * 1000, label: 'primary' });
  const s = data.rate_limit?.secondary_window;
  if (s) windows.push({ usedPercent: s.used_percent, windowMinutes: s.limit_window_seconds / 60, resetsAt: s.reset_at * 1000, label: 'secondary' });
  return { provider: 'codex', plan: data.plan_type, windows, raw: data };
}
