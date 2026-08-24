import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: factory_session=…  or header FACTORY_API_KEY (from app.factory.ai)
// Endpoint: GET https://app.factory.ai/api/usage
export async function fetchFactoryUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ usedPercent?: number; usage?: { usedPercent: number; resetAt: number }; resetAt?: number }>(
    ctx,
    'https://app.factory.ai/api/usage',
    auth.token,
  );
  const used = data.usage?.usedPercent ?? data.usedPercent ?? 0;
  const reset = data.usage?.resetAt ?? data.resetAt ?? 0;
  return { provider: 'factory', windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: reset }], raw: data };
}
// alias for CodexBar `droid` (same Factory backend)
export const fetchDroidUsage = fetchFactoryUsage;
