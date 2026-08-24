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

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];
export type ProviderId = KnownProvider | (string & {});

export function isKnownProvider(v: string): v is KnownProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(v);
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
