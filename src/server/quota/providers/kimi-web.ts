import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { fetchKimiUsage } from './kimi';

// Cookie: kimi-auth=… jwt (kimi web alias)
export async function fetchKimiWebUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const snap = await fetchKimiUsage(auth, ctx);
  return { ...snap, provider: 'kimi-web' as never };
}
