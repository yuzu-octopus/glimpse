import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';
import type { RateWindow } from './quota-types';

export const AI_QUOTA_DEFAULTS = { provider: 'codex' as const, cache: '2m' };

export const AI_QUOTA_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: 340,
  preferredHeight: 180,
};

export const aiQuotaSchema = z
  .object({
    type: z.literal('ai-quota'),
    ...sharedWidgetFields,
    provider: z
      .enum([
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
      ])
      .default(() => AI_QUOTA_DEFAULTS.provider),
    token: z.string().optional(),
    tokenFile: z.string().optional(),
    projectId: z.string().optional(),
    baseUrl: z.string().url().optional(),
  })
  .refine((c) => !!c.token || !!c.tokenFile, { message: 'token or tokenFile required' });

export type AiQuotaConfig = z.infer<typeof aiQuotaSchema>;

export function parseWindow(raw: Record<string, unknown>, _kind: string): RateWindow {
  if ('used_percent' in raw) {
    return {
      usedPercent: Number(raw.used_percent),
      windowMinutes: Number((raw.limit_window_seconds as number) ?? 0) / 60,
      resetsAt: Number(raw.reset_at) * 1000,
      label: _kind,
    };
  }
  if ('total' in raw && 'remaining' in raw) {
    const total = Number(raw.total);
    const remaining = Number(raw.remaining);
    return {
      usedPercent: Math.min(100, ((total - remaining) / total) * 100),
      windowMinutes: 0,
      resetsAt: 0,
      label: _kind,
    };
  }
  throw new Error('unknown window shape');
}
