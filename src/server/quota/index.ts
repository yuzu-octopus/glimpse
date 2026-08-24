import { readFileSync } from 'node:fs';
import type { ProviderId, UsageSnapshot } from '../../shared/widgets/quota-types';
import type { WidgetFetchContext } from '../widgets/registry';
import { fetchAnthropicUsage } from './anthropic';
import { fetchClaudeUsage } from './claude';
import { fetchCodexUsage } from './codex';
import { fetchCopilotUsage } from './copilot';
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
  if (provider === 'copilot') return fetchCopilotUsage(auth, ctx);
  throw new Error(`provider ${provider} not implemented`);
}

/**
 * CLI PTY fallback — not implemented.
 * Bun cannot reliably spawn an interactive PTY to drive `codex`/`claude` CLIs
 * for token extraction. Use OAuth/API token (or tokenFile mount) instead.
 * Throws sanitized not-implemented error (no URL/secret leakage).
 */
export async function fetchCliUsage(): Promise<never> {
  throw new Error('CLI PTY fallback not implemented — use OAuth/API token');
}

/**
 * Web cookie fallback — requires browser cookie session (claude.ai / chatgpt.com).
 * Not implemented in Bun server; use OAuth/API token instead.
 * Throws sanitized not-implemented error (no URL/secret leakage).
 */
export async function fetchWebUsage(): Promise<never> {
  throw new Error('web cookie fallback not implemented — use OAuth/API token');
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
