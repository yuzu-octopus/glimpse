import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: __Secure-next-auth.session-token=… (t3.chat)
// Endpoint: POST https://t3.chat/api/trpc/getCustomerData  (tRPC JSONL, Base 4h + Overage monthly)
export async function fetchT3ChatUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{
    base?: { usedPercent: number; resetsAt: number };
    overage?: { usedPercent: number; resetsAt: number };
    usedPercent?: number;
    resetsAt?: number;
  }>(ctx, 'https://t3.chat/api/trpc/getCustomerData', auth.token);
  const windows = [];
  if (data.base) windows.push({ label: 'base', usedPercent: data.base.usedPercent, windowMinutes: 240, resetsAt: data.base.resetsAt });
  if (data.overage) windows.push({ label: 'overage', usedPercent: data.overage.usedPercent, windowMinutes: 43200, resetsAt: data.overage.resetsAt });
  if (!windows.length) windows.push({ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 });
  return { provider: 't3chat' as never, windows, raw: data };
}
