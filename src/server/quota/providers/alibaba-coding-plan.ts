import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchAlibabaUsage } from './alibaba';

// Cookie: aliyun_token=… (alibabacloud coding plan)  — alias of alibaba
export async function fetchAlibabaCodingPlanUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const snap = await fetchAlibabaUsage(auth, ctx);
  return { ...snap, provider: 'alibaba-coding-plan' as never };
}
