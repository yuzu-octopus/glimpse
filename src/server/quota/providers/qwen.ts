import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: qwen_token=…; session=… (qwen.alibaba-inc.com / dashscope.console)
// Endpoint: GET https://dashscope.aliyuncs.com/api/v1/billing
export async function fetchQwenUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ balance?: number; usedPercent?: number }>(ctx, 'https://dashscope.aliyuncs.com/api/v1/billing', auth.token);
  return { provider: 'qwen' as never, windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }], balance: data.balance, raw: data };
}
