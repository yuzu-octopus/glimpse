import { fetchJson } from '../widgets/http';
import type { WidgetFetchContext } from '../widgets/registry';
import type { UsageSnapshot } from '../../shared/widgets/quota-types';

export async function fetchCopilotUsage(
  auth: { token: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const data = await fetchJson<{ premium_interactions?: { used: number; total: number }; chat?: { used: number; total: number } }>(
    ctx,
    'https://api.github.com/copilot/usage',
    { headers: { Authorization: `Bearer ${auth.token}` } },
  );
  const windows = [];
  if (data.premium_interactions) {
    windows.push({
      usedPercent: (data.premium_interactions.used / data.premium_interactions.total) * 100,
      windowMinutes: 0,
      resetsAt: 0,
      label: 'premium',
    });
  }
  if (data.chat) {
    windows.push({
      usedPercent: (data.chat.used / data.chat.total) * 100,
      windowMinutes: 0,
      resetsAt: 0,
      label: 'chat',
    });
  }
  return { provider: 'copilot', windows, raw: data };
}
