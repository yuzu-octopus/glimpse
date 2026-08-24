import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: session=…; __Secure-next-auth.session-token=… (chatgpt.com)
// Endpoint: GET https://chatgpt.com/backend-api/usage (web cookie variant)
export async function fetchOpenaiWebUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ usedPercent?: number; resetsAt?: number; balance?: number }>(
    ctx,
    'https://chatgpt.com/backend-api/usage',
    auth.token,
  );
  return {
    provider: 'openai-web' as never,
    windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 }],
    balance: data.balance,
    raw: data,
  };
}
