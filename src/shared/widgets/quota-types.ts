export const KNOWN_PROVIDERS = [
  'codex',
  'claude',
  'openai',
  'anthropic',
  'copilot',
  'openrouter',
  'deepseek',
  'moonshot',
  'synthetic',
  'deepinfra',
  'fireworks',
  'chutes',
  'groqcloud',
  'groq',
  'warp',
  'codebuff',
  'crof',
  'venice',
  'cline',
  'clinepass',
  'llmproxy',
  'clawrouter',
  'wayfinder',
  'litellm',
  'deepgram',
  'neuralwatt',
  'zenmux',
  'xai',
  'doubao',
  'zai',
  'kilo',
  'kilocode',
  'mistral',
  'perplexity',
  'cursor',
  'factory',
  'droid',
  'sakana',
  'abacus',
  'notion',
  't3chat',
  'opencode',
  'opencode-go',
  'alibaba',
  'alibaba-coding-plan',
  'alibaba-token-plan',
  'qwen',
  'qwen-cloud',
  'manus',
  'minimax',
  'kimi',
  'kimi-web',
  'commandcode',
  'devin',
  'xiaomi-mimo',
  'windsurf',
  'openai-web',
  'claude-web',
  'gemini',
  'vertex',
  'jetbrains',
  'zed',
  'augment',
  'amp',
  'antigravity',
  'grok',
  'ollama',
  'bedrock',
  'stepfun',
  'kiro',
] as const;

export type ProviderId = string;

/** Pull an auth token out of a JSON credential file body (codex/claude/grok/zed/…); undefined if not JSON-with-token. */
export function extractToken(raw: string): string | undefined {
  try {
    const j: unknown = JSON.parse(raw);
    if (!j || typeof j !== 'object') return undefined;
    const o = j as Record<string, unknown>;
    const tok = o.access_token ?? o.accessToken ?? o.token ?? o.apiKey ?? o.api_key;
    return tok ? String(tok) : undefined;
  } catch {
    return undefined;
  }
}

export interface RateWindow {
  usedPercent: number;
  windowMinutes: number;
  resetsAt: number;
  label?: string;
}

export interface UsageSnapshot {
  provider: ProviderId;
  plan?: string;
  windows: RateWindow[];
  balance?: number;
  raw?: unknown;
}
