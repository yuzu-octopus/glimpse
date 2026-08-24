import { readFileSync } from 'node:fs';
import type { ProviderId, UsageSnapshot } from '../../shared/widgets/quota-types';
import type { WidgetFetchContext } from '../widgets/registry';
import { fetchAnthropicUsage } from './anthropic';
import { fetchClaudeUsage } from './claude';
import { fetchCodexUsage } from './codex';
import { fetchOpenaiUsage } from './openai';

export async function fetchUsage(
  provider: ProviderId,
  auth: { token: string; accountId?: string; projectId?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  if (provider === 'codex') return fetchCodexUsage(auth, ctx);
  if (provider === 'claude') return fetchClaudeUsage(auth, ctx);
  if (provider === 'openai') return fetchOpenaiUsage(auth, ctx);
  if (provider === 'anthropic') return fetchAnthropicUsage(auth, ctx);
  if (provider === 'copilot') throw new Error('provider copilot not implemented — use GitHub token');
  throw new Error(`provider ${provider} not implemented`);
}

export function resolveAuth(
  env: Record<string, string | undefined>,
  cfg: { token?: string; tokenFile?: string; accountId?: string },
): { token: string; accountId?: string } {
  if (cfg.token) return { token: cfg.token, accountId: cfg.accountId };
  if (cfg.tokenFile) {
    try {
      const raw = readFileSync(cfg.tokenFile, 'utf8').trim();
      if (raw) return { token: raw, accountId: cfg.accountId };
    } catch {}
  }
  const tok = env.CODEX_TOKEN ?? env.OPENAI_API_KEY;
  if (!tok) throw new Error('no token: set token or tokenFile');
  return { token: tok, accountId: cfg.accountId ?? env.CHATGPT_ACCOUNT_ID };
}
