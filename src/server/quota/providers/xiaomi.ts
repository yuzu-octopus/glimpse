import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: mimo_session=…; serviceToken=… (xiaomi mimo / mimo.chat)
export async function fetchXiaomiMimoUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number }>(ctx, 'https://mimo.chat/api/billing', auth.token);
  return { provider: 'xiaomi-mimo' as never, windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
