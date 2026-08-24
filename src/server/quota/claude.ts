import { fetchJson } from '../widgets/http';
import type { WidgetFetchContext } from '../widgets/registry';
import type { UsageSnapshot } from '../../shared/widgets/quota-types';

type ClaudeWindow = { utilization?: number; used_percent?: number; reset_at?: string; resetAt?: number };

export async function fetchClaudeUsage(
  auth: { token: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const data = await fetchJson<Record<string, ClaudeWindow>>(
    ctx,
    'https://api.anthropic.com/api/oauth/usage',
    { headers: { Authorization: `Bearer ${auth.token}`, 'anthropic-beta': 'oauth-2025-04-20' } },
  );
  const windows: UsageSnapshot['windows'] = [];
  for (const [label, v] of Object.entries(data)) {
    if (!label.includes('_')) continue;
    windows.push({
      usedPercent: Number(v.utilization ?? v.used_percent ?? 0),
      windowMinutes: label === 'five_hour' ? 300 : 10080,
      resetsAt: v.reset_at ? Date.parse(v.reset_at) : Number(v.resetAt ?? 0) * 1000,
      label,
    });
  }
  return { provider: 'claude', windows, raw: data };
}

/** Web fallback — requires PTY/cookie session that Bun cannot spawn; stub. */
export async function fetchClaudeWebUsage(
  _auth: { token: string; organizationId?: string },
  _ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  // sanitized, no URL/secret leakage
  throw new Error('claude web fallback not implemented — use OAuth token');
}
