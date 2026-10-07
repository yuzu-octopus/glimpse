import type { UsageSnapshot } from "../../shared/widgets/quota-types";
import { fetchJson } from "../widgets/http";
import type { WidgetFetchContext } from "../widgets/registry";

export async function fetchCopilotUsage(
	auth: { token: string },
	ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
	const data = await fetchJson<{
		premium_interactions?: { used: number; total: number };
		chat?: { used: number; total: number };
	}>(ctx, "https://api.github.com/copilot/usage", {
		headers: { Authorization: `Bearer ${auth.token}` },
	});
	const windows = [];
	// A plan with no quota reports total: 0, and 0/0 renders as "NaN%".
	if (data.premium_interactions) {
		windows.push({
			usedPercent:
				data.premium_interactions.total > 0
					? (data.premium_interactions.used / data.premium_interactions.total) * 100
					: 0,
			windowMinutes: 0,
			resetsAt: 0,
			label: "premium",
		});
	}
	if (data.chat) {
		windows.push({
			usedPercent: data.chat.total > 0 ? (data.chat.used / data.chat.total) * 100 : 0,
			windowMinutes: 0,
			resetsAt: 0,
			label: "chat",
		});
	}
	return { provider: "copilot", windows, raw: data };
}
