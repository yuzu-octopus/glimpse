import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: session=… (commandcode / commander)
export async function fetchCommandcodeUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number }>(ctx, 'https://commandcode.ai/api/billing', auth.token);
  return { provider: 'commandcode' as never, windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
