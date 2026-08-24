export type ProviderId =
  | 'codex'
  | 'claude'
  | 'openai'
  | 'anthropic'
  | 'copilot'
  | 'openrouter'
  | 'deepseek'
  | 'moonshot'
  | 'synthetic'
  | 'deepinfra'
  | 'fireworks'
  | 'chutes'
  | 'groqcloud'
  | 'groq'
  | 'warp'
  | 'codebuff'
  | 'crof'
  | 'venice'
  | 'cline'
  | 'clinepass'
  | 'llmproxy'
  | 'clawrouter'
  | 'wayfinder'
  | 'litellm'
  | 'deepgram'
  | 'neuralwatt'
  | 'zenmux'
  | 'xai'
  | 'doubao'
  | 'zai'
  | 'kilo'
  | 'kilocode'
  | 'mistral'
  | 'perplexity'
  | 'cursor'
  | 'factory'
  | 'droid'
  | 'sakana'
  | 'abacus'
  | 'notion'
  | 't3chat'
  | 'opencode'
  | 'alibaba'
  | 'alibaba-coding-plan'
  | 'alibaba-token-plan'
  | 'qwen'
  | 'qwen-cloud'
  | 'manus'
  | 'minimax'
  | 'kimi'
  | 'kimi-web'
  | 'commandcode'
  | 'devin'
  | 'xiaomi-mimo'
  | 'windsurf'
  | 'openai-web'
  | 'claude-web';

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
