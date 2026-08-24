import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: aliyun_token=…; session=…  (alibaba cloud / lingma)
// Endpoint: GET https://coding.alibabacloud.com/api/billing  (coding plan) or token plan variant
export async function fetchAlibabaUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number }>(
    ctx,
    'https://coding.alibabacloud.com/api/billing',
    auth.token,
  );
  return {
    provider: 'alibaba' as never,
    windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }],
    balance: data.balance,
    raw: data,
  };
}
export const fetchAlibabaCodingPlanUsage = fetchAlibabaUsage;
export const fetchAlibabaTokenPlanUsage = fetchAlibabaUsage;
