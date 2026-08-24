import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

// Cookie: sessionKey=… (claude.ai)  — web fallback: GET https://claude.ai/api/organizations/{id}/usage
export async function fetchClaudeWebUsage(auth: { token: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const data = await webFetchJson<{ usedPercent?: number; resetsAt?: number; five_hour?: { utilization: number; reset_at: string } }>(
    ctx,
    'https://claude.ai/api/organizations/usage',
    auth.token,
  );
  const used = data.five_hour?.utilization ?? data.usedPercent ?? 0;
  const resetsAt = data.five_hour?.reset_at ? Date.parse(data.five_hour.reset_at) : (data.resetsAt ?? 0);
  return { provider: 'claude-web' as never, windows: [{ label: 'five_hour', usedPercent: used, windowMinutes: 300, resetsAt }], raw: data };
}
