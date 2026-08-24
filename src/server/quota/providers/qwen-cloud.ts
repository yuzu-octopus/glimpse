import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchQwenUsage } from './qwen';

// Cookie: qwen_token=… (qwen cloud variant, same endpoint)
export async function fetchQwenCloudUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const snap = await fetchQwenUsage(auth, ctx);
  return { ...snap, provider: 'qwen-cloud' as never };
}
