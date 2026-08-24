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
  | 'perplexity';

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
