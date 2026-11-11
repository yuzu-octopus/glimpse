import { aiQuotaSchema } from "../../shared/widgets/ai-quota";
import type { AiQuotaData } from "../../shared/widgets/payloads";
import { fetchUsage, resolveAuth } from "../quota";
import { registerWidget, type WidgetFetchContext } from "./registry";

registerWidget(
	"ai-quota",
	async (ctx: WidgetFetchContext, cfg: Record<string, unknown>): Promise<AiQuotaData> => {
		const c = aiQuotaSchema.parse(cfg);
		const { token, accountId } = await resolveAuth(
			ctx.env,
			{ tokenFile: c.tokenFile, accountId: c.accountId },
			c.provider,
		);
		const snap = await fetchUsage(
			c.provider as never,
			{
				token,
				accountId,
				projectId: c.projectId,
				baseUrl: c.baseUrl,
				quotaUrl: c.quotaUrl,
				tokenFile: c.tokenFile,
			},
			ctx,
		);
		return {
			provider: snap.provider,
			plan: snap.plan,
			windows: snap.windows.map((w) => ({
				label: w.label ?? "window",
				usedPercent: w.usedPercent,
				windowMinutes: w.windowMinutes,
				resetsAt: w.resetsAt,
			})),
			balance: snap.balance,
		};
	},
);
