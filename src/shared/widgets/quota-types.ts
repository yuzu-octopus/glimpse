export type ProviderId = 'codex' | 'claude' | 'openai' | 'anthropic' | 'copilot';

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
