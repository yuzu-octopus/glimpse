import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: session=… (abacus.ai)  — abacus billing
// Endpoint: GET https://api.abacus.ai/api/billing
export async function fetchAbacusUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number; credits?: number }>(
    ctx,
    'https://api.abacus.ai/api/billing',
    auth.token,
  );
  const bal = data.balance ?? data.credits ?? 0;
  const used = data.usedPercent ?? 0;
  return { provider: 'abacus' as never, windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], balance: bal, raw: data };
}
