import { z } from 'zod';
import { sharedWidgetFields, type Pref } from './shared';
import type { RateWindow } from './quota-types';
import { KNOWN_PROVIDERS } from './quota-types';

// Re-export for doc + refine usage
export { KNOWN_PROVIDERS };

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
    // loose: any non-empty string so future CodexBar adds don't break validation
    provider: z.string().min(1).default(() => AI_QUOTA_DEFAULTS.provider),
    token: z.string().optional(),
    // tokenFile docs (inline //): JetBrains ~/.config/JetBrains/*/AIAssistantQuotaManager2.xml, Kiro kiro-cli auth file, Grok ~/.grok/auth.json, Zed credentials
    tokenFile: z.string().optional(),
    quotaUrl: z.url().optional(),
    projectId: z.string().optional(),
    baseUrl: z.url().optional(),
  })
  .refine((c) => !!c.token || !!c.tokenFile, { message: 'token or tokenFile required' })
  .superRefine((c, ctx) => {
    if (!(KNOWN_PROVIDERS as readonly string[]).includes(c.provider)) {
      ctx.addIssue({ code: 'custom', message: `unknown provider '${c.provider}' — known: ${KNOWN_PROVIDERS.slice(0, 5).join(', ')}…` });
    }
  });

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
