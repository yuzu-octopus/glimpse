import { aiQuotaSchema } from '../../shared/widgets/ai-quota';
import { registerWidget, type WidgetFetchContext } from './registry';
import { fetchUsage, resolveAuth } from '../quota';
import type { AiQuotaData } from '../../shared/widgets/payloads';

registerWidget('ai-quota', async (ctx: WidgetFetchContext, cfg: Record<string, unknown>): Promise<AiQuotaData> => {
  const c = aiQuotaSchema.parse(cfg);
  const accountId = (cfg as Record<string, unknown>).accountId as string | undefined;
  const { token } = resolveAuth(ctx.env, { token: c.token, tokenFile: c.tokenFile, accountId }, c.provider);
  const snap = await fetchUsage(c.provider as never, { token, accountId, projectId: c.projectId, baseUrl: c.baseUrl, quotaUrl: c.quotaUrl, tokenFile: c.tokenFile }, ctx);
  return {
    provider: snap.provider,
    plan: snap.plan,
    windows: snap.windows.map((w) => ({
      label: w.label ?? 'window',
      usedPercent: w.usedPercent,
      windowMinutes: w.windowMinutes,
      resetsAt: w.resetsAt,
    })),
    balance: snap.balance,
  };
});
