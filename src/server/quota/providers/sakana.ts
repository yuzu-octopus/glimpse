import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: session=… (console.sakana.ai) — pay-as-you-go fugu balance
// Endpoint: GET https://console.sakana.ai/api/billing (best-effort second fetch for fugu)
export async function fetchSakanaUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; credits?: number; usedPercent?: number }>(
    ctx,
    'https://console.sakana.ai/api/billing',
    auth.token,
  );
  const bal = data.balance ?? data.credits ?? 0;
  const used = data.usedPercent ?? (bal ? 0 : 0);
  return { provider: 'sakana' as never, windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], balance: bal, raw: data };
}
