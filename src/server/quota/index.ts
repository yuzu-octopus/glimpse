import { readFileSync } from 'node:fs';
import { extractToken, type ProviderId, type UsageSnapshot } from '../../shared/widgets/quota-types';
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

type ProviderAuth = {
  token: string;
  accountId?: string;
  projectId?: string;
  baseUrl?: string;
  quotaUrl?: string;
  tokenFile?: string;
};

const PROVIDERS: Record<string, (auth: ProviderAuth, ctx: WidgetFetchContext) => Promise<UsageSnapshot>> = {
  codex: fetchCodexUsage,
  claude: fetchClaudeUsage,
  openai: fetchOpenaiUsage,
  anthropic: fetchAnthropicUsage,
  copilot: fetchCopilotUsage,
  openrouter: fetchOpenRouterUsage,
  deepseek: fetchDeepSeekUsage,
  moonshot: fetchMoonshotUsage,
  synthetic: fetchSyntheticUsage,
  deepinfra: fetchDeepInfraUsage,
  fireworks: fetchFireworksUsage,
  chutes: fetchChutesUsage,
  groqcloud: fetchGroqcloudUsage,
  groq: fetchGroqUsage,
  warp: fetchWarpUsage,
  codebuff: fetchCodebuffUsage,
  crof: fetchCrofUsage,
  venice: fetchVeniceUsage,
  cline: fetchClineUsage,
  clinepass: fetchClineUsage,
  llmproxy: fetchLlmproxyUsage,
  clawrouter: fetchClawrouterUsage,
  wayfinder: fetchWayfinderUsage,
  litellm: fetchLitellmUsage,
  deepgram: fetchDeepgramUsage,
  neuralwatt: fetchNeuralwattUsage,
  zenmux: fetchZenmuxUsage,
  xai: fetchXaiUsage,
  doubao: fetchDoubaoUsage,
  zai: fetchZaiUsage,
  kilo: fetchKiloUsage,
  kilocode: fetchKilocodeUsage,
  mistral: fetchMistralUsage,
  perplexity: fetchPerplexityUsage,
  cursor: fetchCursorUsage,
  factory: fetchFactoryUsage,
  droid: fetchFactoryUsage,
  sakana: fetchSakanaUsage,
  abacus: fetchAbacusUsage,
  notion: fetchNotionUsage,
  t3chat: fetchT3ChatUsage,
  opencode: fetchOpencodeUsage,
  'opencode-go': fetchOpencodeUsage,
  alibaba: fetchAlibabaUsage,
  'alibaba-coding-plan': fetchAlibabaCodingPlanUsage,
  'alibaba-token-plan': fetchAlibabaTokenPlanUsage,
  qwen: fetchQwenUsage,
  'qwen-cloud': fetchQwenCloudUsage,
  manus: fetchManusUsage,
  minimax: fetchMinimaxUsage,
  kimi: fetchKimiUsage,
  'kimi-web': fetchKimiWebUsage,
  commandcode: fetchCommandcodeUsage,
  devin: fetchDevinUsage,
  'xiaomi-mimo': fetchXiaomiMimoUsage,
  windsurf: fetchWindsurfUsage,
  'openai-web': fetchOpenaiWebUsage,
  'claude-web': fetchClaudeWebUsage,
  jetbrains: fetchJetbrainsUsage,
  zed: fetchZedUsage,
  gemini: fetchGeminiUsage,
  vertex: fetchVertexUsage,
  kiro: fetchKiroUsage,
  grok: fetchGrokUsage,
  antigravity: fetchAntigravityUsage,
  augment: fetchAugmentUsage,
  amp: fetchAmpUsage,
  ollama: fetchOllamaUsage,
  bedrock: fetchBedrockUsage,
  stepfun: fetchStepfunUsage,
};

export async function fetchUsage(provider: ProviderId, auth: ProviderAuth, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const fetcher = PROVIDERS[provider];
  if (!fetcher) throw new Error(`provider ${provider} not implemented — contributors: add Sources/CodexBarCore/Providers/${provider}`);
  return fetcher(auth, ctx);
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

function readTokenFrom(raw: string): string | undefined {
  const trimmed = raw.trim();
  // JSON credential files (codex/claude/grok/zed): pull the token field; otherwise the raw text IS the token
  return trimmed ? (extractToken(trimmed) ?? trimmed) : undefined;
}

export function resolveAuth(
  env: Record<string, string | undefined>,
  cfg: { token?: string; tokenFile?: string; accountId?: string },
  provider?: string,
): { token: string; accountId?: string } {
  if (cfg.token) return { token: cfg.token, accountId: cfg.accountId };
  if (cfg.tokenFile) {
    try {
      const tok = readTokenFrom(readFileSync(cfg.tokenFile, 'utf8'));
      if (tok) return { token: tok, accountId: cfg.accountId };
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
        const tok = readTokenFrom(readFileSync(p, 'utf8'));
        if (tok) return { token: tok, accountId: cfg.accountId };
      } catch {}
    }
  }
  const tok = env.CODEX_TOKEN ?? env.OPENAI_API_KEY ?? env.ANTHROPIC_API_KEY ?? env.GITHUB_TOKEN;
  if (tok) return { token: tok, accountId: cfg.accountId ?? env.CHATGPT_ACCOUNT_ID };
  throw new Error('no token: set token, tokenFile, or provider env var');
}
