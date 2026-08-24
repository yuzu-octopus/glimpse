import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: kimi-auth=… (jwt from kimi.moonshot.cn)  — web strategy
// Endpoint: GET https://www.kimi.com/api/billing  (or platform.moonshot.cn variant)
export async function fetchKimiUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number; kimi_credits?: number }>(
    ctx,
    'https://www.kimi.com/api/billing',
    auth.token,
  );
  const bal = data.balance ?? data.kimi_credits ?? 0;
  return { provider: 'kimi' as never, windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }], balance: bal, raw: data };
}
