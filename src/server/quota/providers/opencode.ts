import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: session=… (opencode.ai)
// Endpoint: GET https://opencode.ai/api/usage
export async function fetchOpencodeUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ usedPercent?: number; balance?: number; resetsAt?: number }>(
    ctx,
    'https://opencode.ai/api/usage',
    auth.token,
  );
  return {
    provider: 'opencode' as never,
    windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 }],
    balance: data.balance,
    raw: data,
  };
}
