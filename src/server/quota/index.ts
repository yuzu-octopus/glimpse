import { readFileSync } from 'node:fs';
import type { ProviderId, UsageSnapshot } from '../../shared/widgets/quota-types';
import type { WidgetFetchContext } from '../widgets/registry';
import { fetchAnthropicUsage } from './anthropic';
import { fetchChutesUsage } from './providers/chutes';
import { fetchClaudeUsage } from './claude';
import { fetchClawrouterUsage } from './providers/clawrouter';
import { fetchClineUsage } from './providers/cline';
import { fetchCodebuffUsage } from './providers/codebuff';
import { fetchCodexUsage } from './codex';
import { fetchCopilotUsage } from './copilot';
import { fetchCrofUsage } from './providers/crof';
import { fetchDeepInfraUsage } from './providers/deepinfra';
import { fetchDeepSeekUsage } from './providers/deepseek';
import { fetchDeepgramUsage } from './providers/deepgram';
import { fetchDoubaoUsage } from './providers/doubao';
import { fetchFireworksUsage } from './providers/fireworks';
import { fetchGroqUsage } from './providers/groq';
import { fetchGroqcloudUsage } from './providers/groqcloud';
import { fetchKilocodeUsage } from './providers/kilocode';
import { fetchKiloUsage } from './providers/kilo';
import { fetchLitellmUsage } from './providers/litellm';
import { fetchLlmproxyUsage } from './providers/llmproxy';
import { fetchAbacusUsage } from './providers/abacus';
import { fetchAlibabaCodingPlanUsage } from './providers/alibaba-coding-plan';
import { fetchAlibabaTokenPlanUsage } from './providers/alibaba-token-plan';
import { fetchAlibabaUsage } from './providers/alibaba';
import { fetchClaudeWebUsage } from './providers/claude-web';
import { fetchCommandcodeUsage } from './providers/commandcode';
import { fetchCursorUsage } from './providers/cursor';
import { fetchDevinUsage } from './providers/devin';
import { fetchFactoryUsage } from './providers/factory';
import { fetchKimiUsage } from './providers/kimi';
import { fetchKimiWebUsage } from './providers/kimi-web';
import { fetchManusUsage } from './providers/manus';
import { fetchMinimaxUsage } from './providers/minimax';
import { fetchMistralUsage } from './providers/mistral';
import { fetchMoonshotUsage } from './providers/moonshot';
import { fetchNeuralwattUsage } from './providers/neuralwatt';
import { fetchNotionUsage } from './providers/notion';
import { fetchOpenRouterUsage } from './providers/openrouter';
import { fetchOpenaiUsage } from './openai';
import { fetchOpenaiWebUsage } from './providers/openai-web';
import { fetchOpencodeUsage } from './providers/opencode';
import { fetchPerplexityUsage } from './providers/perplexity';
import { fetchQwenCloudUsage } from './providers/qwen-cloud';
import { fetchQwenUsage } from './providers/qwen';
import { fetchSakanaUsage } from './providers/sakana';
import { fetchSyntheticUsage } from './providers/synthetic';
import { fetchT3ChatUsage } from './providers/t3chat';
import { fetchVeniceUsage } from './providers/venice';
import { fetchWarpUsage } from './providers/warp';
import { fetchWayfinderUsage } from './providers/wayfinder';
import { fetchWindsurfUsage } from './providers/windsurf';
import { fetchXaiUsage } from './providers/xai';
import { fetchXiaomiMimoUsage } from './providers/xiaomi';
import { fetchZaiUsage } from './providers/zai';
import { fetchZenmuxUsage } from './providers/zenmux';

export async function fetchUsage(
  provider: ProviderId,
  auth: { token: string; accountId?: string; projectId?: string; baseUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  if (provider === 'codex') return fetchCodexUsage(auth, ctx);
  if (provider === 'claude') return fetchClaudeUsage(auth, ctx);
  if (provider === 'openai') return fetchOpenaiUsage(auth, ctx);
  if (provider === 'anthropic') return fetchAnthropicUsage(auth, ctx);
  if (provider === 'copilot') return fetchCopilotUsage(auth, ctx);
  if (provider === 'openrouter') return fetchOpenRouterUsage(auth, ctx);
  if (provider === 'deepseek') return fetchDeepSeekUsage(auth, ctx);
  if (provider === 'moonshot') return fetchMoonshotUsage(auth as { token: string; baseUrl?: string }, ctx);
  if (provider === 'synthetic') return fetchSyntheticUsage(auth, ctx);
  if (provider === 'deepinfra') return fetchDeepInfraUsage(auth, ctx);
  if (provider === 'fireworks') return fetchFireworksUsage(auth, ctx);
  if (provider === 'chutes') return fetchChutesUsage(auth, ctx);
  if (provider === 'groqcloud') return fetchGroqcloudUsage(auth, ctx);
  if (provider === 'groq') return fetchGroqUsage(auth, ctx);
  if (provider === 'warp') return fetchWarpUsage(auth, ctx);
  if (provider === 'codebuff') return fetchCodebuffUsage(auth, ctx);
  if (provider === 'crof') return fetchCrofUsage(auth, ctx);
  if (provider === 'venice') return fetchVeniceUsage(auth, ctx);
  if (provider === 'cline' || provider === 'clinepass') return fetchClineUsage(auth, ctx);
  if (provider === 'llmproxy') return fetchLlmproxyUsage(auth as { token: string; baseUrl?: string }, ctx);
  if (provider === 'clawrouter') return fetchClawrouterUsage(auth, ctx);
  if (provider === 'wayfinder') return fetchWayfinderUsage(auth, ctx);
  if (provider === 'litellm') return fetchLitellmUsage(auth as { token: string; baseUrl?: string }, ctx);
  if (provider === 'deepgram') return fetchDeepgramUsage(auth, ctx);
  if (provider === 'neuralwatt') return fetchNeuralwattUsage(auth, ctx);
  if (provider === 'zenmux') return fetchZenmuxUsage(auth, ctx);
  if (provider === 'xai') return fetchXaiUsage(auth, ctx);
  if (provider === 'doubao') return fetchDoubaoUsage(auth, ctx);
  if (provider === 'zai') return fetchZaiUsage(auth as { token: string; baseUrl?: string }, ctx);
  if (provider === 'kilo') return fetchKiloUsage(auth, ctx);
  if (provider === 'kilocode') return fetchKilocodeUsage(auth, ctx);
  if (provider === 'mistral') return fetchMistralUsage(auth, ctx);
  if (provider === 'perplexity') return fetchPerplexityUsage(auth, ctx);
  if (provider === 'cursor') return fetchCursorUsage(auth, ctx);
  if (provider === 'factory' || provider === 'droid') return fetchFactoryUsage(auth, ctx);
  if (provider === 'sakana') return fetchSakanaUsage(auth, ctx);
  if (provider === 'abacus') return fetchAbacusUsage(auth, ctx);
  if (provider === 'notion') return fetchNotionUsage(auth, ctx);
  if (provider === 't3chat') return fetchT3ChatUsage(auth, ctx);
  if (provider === 'opencode') return fetchOpencodeUsage(auth, ctx);
  if (provider === 'alibaba') return fetchAlibabaUsage(auth, ctx);
  if (provider === 'alibaba-coding-plan') return fetchAlibabaCodingPlanUsage(auth, ctx);
  if (provider === 'alibaba-token-plan') return fetchAlibabaTokenPlanUsage(auth, ctx);
  if (provider === 'qwen') return fetchQwenUsage(auth, ctx);
  if (provider === 'qwen-cloud') return fetchQwenCloudUsage(auth, ctx);
  if (provider === 'manus') return fetchManusUsage(auth, ctx);
  if (provider === 'minimax') return fetchMinimaxUsage(auth, ctx);
  if (provider === 'kimi') return fetchKimiUsage(auth, ctx);
  if (provider === 'kimi-web') return fetchKimiWebUsage(auth, ctx);
  if (provider === 'commandcode') return fetchCommandcodeUsage(auth, ctx);
  if (provider === 'devin') return fetchDevinUsage(auth, ctx);
  if (provider === 'xiaomi-mimo') return fetchXiaomiMimoUsage(auth, ctx);
  if (provider === 'windsurf') return fetchWindsurfUsage(auth, ctx);
  if (provider === 'openai-web') return fetchOpenaiWebUsage(auth, ctx);
  if (provider === 'claude-web') return fetchClaudeWebUsage(auth, ctx);
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
