import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: windsurf_session=… (windsurf.com / codeium)
export async function fetchWindsurfUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number }>(ctx, 'https://windsurf.com/api/billing', auth.token);
  return { provider: 'windsurf' as never, windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
