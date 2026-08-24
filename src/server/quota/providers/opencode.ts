import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchJson } from '../../widgets/http';
import { webFetchJson } from './web';

// CodexBar: opencode = web dashboard via cookies (legacy), opencode-go = API key.
// Glimpse supports both for either provider id:
// - API key (Bearer) → GET https://opencode.ai/zen/go/v1/usage {usage:{rolling,weekly,monthly}}
// - Cookie fallback → GET https://opencode.ai/api/usage via Cookie header
export async function fetchOpencodeUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  // Try API-key path first — if token looks like an API key, prefer Bearer.
  // Fall back to cookie path for session=… tokens.
  const looksLikeApiKey = !auth.token.includes('=') && !auth.token.toLowerCase().includes('cookie');
  if (looksLikeApiKey) {
    try {
      const data = await fetchJson<{
        usage?: {
          rolling?: { percent?: number; resetsAt?: string };
          weekly?: { percent?: number; resetsAt?: string };
          monthly?: { percent?: number; resetsAt?: string };
        };
      }>(ctx, 'https://opencode.ai/zen/go/v1/usage', {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (data.usage) {
        const windows: UsageSnapshot['windows'] = [];
        if (data.usage.rolling)
          windows.push({
            label: 'rolling',
            usedPercent: data.usage.rolling.percent ?? 0,
            windowMinutes: 300,
            resetsAt: data.usage.rolling.resetsAt ? Date.parse(data.usage.rolling.resetsAt) : 0,
          });
        if (data.usage.weekly)
          windows.push({
            label: 'weekly',
            usedPercent: data.usage.weekly.percent ?? 0,
            windowMinutes: 10080,
            resetsAt: data.usage.weekly.resetsAt ? Date.parse(data.usage.weekly.resetsAt) : 0,
          });
        if (data.usage.monthly)
          windows.push({
            label: 'monthly',
            usedPercent: data.usage.monthly.percent ?? 0,
            windowMinutes: 43200,
            resetsAt: data.usage.monthly.resetsAt ? Date.parse(data.usage.monthly.resetsAt) : 0,
          });
        return { provider: 'opencode', windows, raw: data };
      }
    } catch {
      // fall through to cookie path
    }
  }
  const data = await webFetchJson<{ usedPercent?: number; balance?: number; resetsAt?: number }>(
    ctx,
    'https://opencode.ai/api/usage',
    auth.token,
  );
  return {
    provider: 'opencode',
    windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 }],
    balance: data.balance,
    raw: data,
  };
}
