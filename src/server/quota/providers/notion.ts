import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: token_v2=…; notin_last_… (app.notion.com)
// Flow: POST https://app.notion.com/api/v3/getSpaces → POST /getCreditRateLimitStatus (6h + monthly)
export async function fetchNotionUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{
    credits?: number;
    usedPercent?: number;
    sixHour?: { usedPercent: number; resetsAt: number };
    monthly?: { usedPercent: number; resetsAt: number };
  }>(ctx, 'https://app.notion.com/api/v3/getCreditRateLimitStatus', auth.token);
  const windows = [];
  if (data.sixHour) windows.push({ label: '6h', usedPercent: data.sixHour.usedPercent, windowMinutes: 360, resetsAt: data.sixHour.resetsAt });
  if (data.monthly) windows.push({ label: 'monthly', usedPercent: data.monthly.usedPercent, windowMinutes: 43200, resetsAt: data.monthly.resetsAt });
  if (!windows.length) windows.push({ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 });
  return { provider: 'notion' as never, windows, balance: data.credits, raw: data };
}
