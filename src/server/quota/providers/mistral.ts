import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// token: MISTRAL_API_KEY (Bearer)  OR  Cookie: ory_session_*=…; csrftoken=…  (console.mistral.ai)
// Web: GET https://console.mistral.ai/api/billing + GET https://admin.mistral.ai/api/billing/credits
// API:  GET https://api.mistral.ai/v1/balance
export async function fetchMistralUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const isCookie = auth.token.includes('=') || auth.token.includes(';');
  if (isCookie) {
    const data = await webFetchJson<{ balance?: number; credits?: number; total?: number }>(
      ctx,
      'https://console.mistral.ai/api/billing',
      auth.token,
    );
    const bal = data.balance ?? data.credits ?? 0;
    const total = data.total ?? 100;
    return {
      provider: 'mistral',
      windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - bal) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
      balance: bal,
      raw: data,
    };
  }
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.mistral.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return {
    provider: 'mistral',
    windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
    balance: data.balance,
    raw: data,
  };
}
