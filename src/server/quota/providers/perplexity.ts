import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchJson } from '../../widgets/http';
import { webFetchJson } from './web';

// Cookie: session=…; __Secure-next-auth.session-token=… (www.perplexity.ai)
// Endpoint: GET https://www.perplexity.ai/api/auth/session → { recurringCredits, bonusCredits, purchasedCredits, renewalDate }
export async function fetchPerplexityUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  // If token looks like Bearer (no '=' and no ';'), fall back to api.perplexity.ai balance (API strategy)
  const isCookie = auth.token.includes('=') || auth.token.includes(';');
  if (!isCookie) {
    const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.perplexity.ai/balance', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const total = data.total ?? 100;
    return {
      provider: 'perplexity',
      windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
      balance: data.balance,
      raw: data,
    };
  }
  const data = await webFetchJson<{ recurringCredits?: number; bonusCredits?: number; purchasedCredits?: number; renewalDate?: string }>(
    ctx,
    'https://www.perplexity.ai/api/auth/session',
    auth.token,
  );
  const recurring = data.recurringCredits ?? 0;
  const bonus = data.bonusCredits ?? 0;
  const total = recurring + bonus + (data.purchasedCredits ?? 0);
  const used = total ? Math.min(100, ((total - recurring - bonus) / total) * 100) : 0;
  // prefer balance = remaining recurring + bonus
  const balance = recurring + bonus;
  return {
    provider: 'perplexity',
    windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: data.renewalDate ? Date.parse(data.renewalDate) : 0 }],
    balance,
    raw: data,
  };
}
