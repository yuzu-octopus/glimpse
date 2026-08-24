import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchAlibabaUsage } from './alibaba';

// Cookie: aliyun_token=… (alibabacloud token plan) — alias
export async function fetchAlibabaTokenPlanUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const snap = await fetchAlibabaUsage(auth, ctx);
  return { ...snap, provider: 'alibaba-token-plan' as never };
}
