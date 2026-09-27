import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';
import { KNOWN_PROVIDERS } from './quota-types';

// Re-export for doc + refine usage

export const AI_QUOTA_DEFAULTS = { provider: 'codex' as const };

export const AI_QUOTA_PREF: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: 340,
  preferredHeight: 180,
};

export const AI_QUOTA_SKELETON: SkeletonShape = 'stat';

// No `token` field: the config is served to the browser verbatim, so a token
// in the YAML is a token in the page. `tokenFile` is a path, not a secret, and
// stays; everything else resolves from the environment (see quota/index.ts).
export const aiQuotaSchema = z
  .object({
    type: z.literal('ai-quota'),
    ...sharedWidgetFields,
    // loose: any non-empty string so future CodexBar adds don't break validation
    provider: z.string().min(1).default(() => AI_QUOTA_DEFAULTS.provider),
    // tokenFile docs (inline //): JetBrains ~/.config/JetBrains/*/AIAssistantQuotaManager2.xml, Kiro kiro-cli auth file, Grok ~/.grok/auth.json, Zed credentials
    tokenFile: z.string().optional(),
    quotaUrl: z.url().optional(),
    projectId: z.string().optional(),
    baseUrl: z.url().optional(),
  })
  .superRefine((c, ctx) => {
    if (!(KNOWN_PROVIDERS as readonly string[]).includes(c.provider)) {
      ctx.addIssue({ code: 'custom', message: `unknown provider '${c.provider}' — known: ${KNOWN_PROVIDERS.slice(0, 5).join(', ')}…` });
    }
  });

export type AiQuotaConfig = z.infer<typeof aiQuotaSchema>;
