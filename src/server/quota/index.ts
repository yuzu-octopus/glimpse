import { readFileSync } from 'node:fs';
import { extractToken, type ProviderId, type UsageSnapshot } from '../../shared/widgets/quota-types';
import type { WidgetFetchContext } from '../widgets/registry';
import { fetchAnthropicUsage } from './anthropic';
import { fetchClaudeUsage } from './claude';
import { fetchCodexUsage } from './codex';
import { fetchCopilotUsage } from './copilot';
import { fetchOpenaiUsage } from './openai';
import { fetchGeminiUsage } from './providers/gemini';
import { fetchGrokUsage } from './providers/grok';
import { fetchOpencodeUsage } from './providers/opencode';
import { fetchVertexUsage } from './providers/vertex';
import { PROVIDER_TABLE, fetchTableRow, type ProviderAuth } from './providers/providerTable';

export const PROVIDERS: Record<string, (auth: ProviderAuth, ctx: WidgetFetchContext) => Promise<UsageSnapshot>> = {
  codex: fetchCodexUsage,
  claude: fetchClaudeUsage,
  openai: fetchOpenaiUsage,
  anthropic: fetchAnthropicUsage,
  copilot: fetchCopilotUsage,
  opencode: fetchOpencodeUsage,
  'opencode-go': fetchOpencodeUsage,
  gemini: fetchGeminiUsage,
  vertex: fetchVertexUsage,
  grok: fetchGrokUsage,
};

for (const row of PROVIDER_TABLE) PROVIDERS[row.id] = (auth, ctx) => fetchTableRow(row, auth, ctx);

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
