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
import { fetchAmpUsage } from './providers/amp';
import { fetchAntigravityUsage } from './providers/antigravity';
import { fetchAugmentUsage } from './providers/augment';
import { fetchBedrockUsage } from './providers/bedrock';
import { fetchClaudeWebUsage } from './providers/claude-web';
import { fetchCommandcodeUsage } from './providers/commandcode';
import { fetchCursorUsage } from './providers/cursor';
import { fetchDevinUsage } from './providers/devin';
import { fetchFactoryUsage } from './providers/factory';
import { fetchGeminiUsage } from './providers/gemini';
import { fetchGrokUsage } from './providers/grok';
import { fetchJetbrainsUsage } from './providers/jetbrains';
import { fetchKimiUsage } from './providers/kimi';
import { fetchKiroUsage } from './providers/kiro';
import { fetchOllamaUsage } from './providers/ollama';
import { fetchStepfunUsage } from './providers/stepfun';
import { fetchVertexUsage } from './providers/vertex';
import { fetchZedUsage } from './providers/zed';
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
  auth: { token: string; accountId?: string; projectId?: string; baseUrl?: string; quotaUrl?: string; tokenFile?: string },
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
  if (provider === 'opencode' || provider === 'opencode-go') return fetchOpencodeUsage(auth, ctx);
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
  if (provider === 'jetbrains') return fetchJetbrainsUsage(auth as { token: string; tokenFile?: string }, ctx);
  if (provider === 'zed') return fetchZedUsage(auth as { token: string; tokenFile?: string }, ctx);
  if (provider === 'gemini') return fetchGeminiUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'vertex') return fetchVertexUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'kiro') return fetchKiroUsage(auth as { token: string; tokenFile?: string }, ctx);
  if (provider === 'grok') return fetchGrokUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'antigravity') return fetchAntigravityUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'augment') return fetchAugmentUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'amp') return fetchAmpUsage(auth as { token: string; tokenFile?: string }, ctx);
  if (provider === 'ollama') return fetchOllamaUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'bedrock') return fetchBedrockUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  if (provider === 'stepfun') return fetchStepfunUsage(auth as { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string }, ctx);
  throw new Error(`provider ${provider} not implemented — contributors: add Sources/CodexBarCore/Providers/${provider}`);
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

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  codex: ['CODEX_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY'],
  'opencode': ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'],
  'opencode-go': ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_TOKEN'],
  openai: ['OPENAI_ADMIN_KEY', 'OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_ADMIN_KEY', 'ANTHROPIC_API_KEY'],
  copilot: ['GITHUB_TOKEN', 'GH_TOKEN'],
  openrouter: ['OPENROUTER_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  moonshot: ['MOONSHOT_API_KEY'],
  zai: ['ZAI_API_KEY', 'Z_AI_API_KEY'],
  kimi: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
  groq: ['GROQ_API_KEY'],
  groqcloud: ['GROQ_API_KEY'],
  xai: ['XAI_API_KEY', 'XAI_MANAGEMENT_API_KEY'],
  deepinfra: ['DEEPINFRA_API_KEY'],
  fireworks: ['FIREWORKS_API_KEY'],
  chutes: ['CHUTES_API_KEY'],
  warp: ['WARP_API_KEY', 'WARP_TOKEN'],
  codebuff: ['CODEBUFF_API_KEY'],
  crof: ['CROF_API_KEY', 'CROFAI_API_KEY'],
  venice: ['VENICE_API_KEY'],
  cline: ['CLINE_API_KEY', 'CLINEPASS_API_KEY'],
  llmproxy: ['LLM_PROXY_API_KEY'],
  clawrouter: ['CLAWROUTER_API_KEY'],
  wayfinder: ['WAYFINDER_API_KEY'],
  litellm: ['LITELLM_API_KEY'],
  deepgram: ['DEEPGRAM_API_KEY'],
  perchance: ['PERPLEXITY_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY'],
  // web/cookie providers — token is Cookie header, but still allow env passthrough
  cursor: ['CURSOR_API_KEY'],
  factory: ['FACTORY_API_KEY'],
  notion: ['NOTION_API_KEY'],
};

const PROVIDER_FILE_DEFAULTS: Record<string, string> = {
  codex: '~/.codex/auth.json',
  claude: '~/.claude/.credentials.json',
  jetbrains: '~/.config/JetBrains/AIAssistantQuotaManager2.xml',
  zed: '~/.config/zed/credentials',
  kiro: '~/.config/kiro/auth.json',
  grok: '~/.grok/auth.json',
  amp: '~/.config/amp/auth.json',
};

export function resolveAuth(
  env: Record<string, string | undefined>,
  cfg: { token?: string; tokenFile?: string; accountId?: string },
  provider?: string,
): { token: string; accountId?: string } {
  if (cfg.token) return { token: cfg.token, accountId: cfg.accountId };
  if (cfg.tokenFile) {
    try {
      const raw = readFileSync(cfg.tokenFile, 'utf8').trim();
      if (raw) {
        // if file is JSON (codex/claude), extract token field
        try {
          const j = JSON.parse(raw);
          const tok = j.access_token ?? j.accessToken ?? j.token ?? j.apiKey ?? j.api_key;
          if (tok) return { token: String(tok), accountId: cfg.accountId };
        } catch {}
        return { token: raw, accountId: cfg.accountId };
      }
    } catch {}
  }
  if (provider) {
    for (const k of PROVIDER_ENV_KEYS[provider] ?? [`${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`, `${provider.toUpperCase().replace(/-/g, '_')}_TOKEN`]) {
      const v = env[k];
      if (v) return { token: v, accountId: cfg.accountId ?? env.CHATGPT_ACCOUNT_ID };
    }
    const defFile = PROVIDER_FILE_DEFAULTS[provider];
    if (defFile) {
      try {
        const p = defFile.replace(/^~/, env.HOME ?? process.env.HOME ?? '');
        const raw = readFileSync(p, 'utf8').trim();
        if (raw) {
          try {
            const j = JSON.parse(raw);
            const tok = j.access_token ?? j.accessToken ?? j.token ?? j.apiKey ?? j.api_key;
            if (tok) return { token: String(tok), accountId: cfg.accountId };
          } catch {}
          return { token: raw, accountId: cfg.accountId };
        }
      } catch {}
    }
  }
  const tok = env.CODEX_TOKEN ?? env.OPENAI_API_KEY ?? env.ANTHROPIC_API_KEY ?? env.GITHUB_TOKEN;
  if (tok) return { token: tok, accountId: cfg.accountId ?? env.CHATGPT_ACCOUNT_ID };
  throw new Error('no token: set token, tokenFile, or provider env var');
}
