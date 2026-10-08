import * as os from "node:os";
import type { SpeedtestData } from "../../shared/widgets/payloads";
import { speedtestSchema } from "../../shared/widgets/speedtest";
import { getCachedClient, getLastSpeedtestResult, setCachedClient } from "../speedtest";
import { fetchJson } from "./http";
import { registerWidget } from "./registry";

function localIp(): string {
	const ifs = os.networkInterfaces();
	for (const addrs of Object.values(ifs)) {
		if (!addrs) continue;
		for (const a of addrs) {
			if (a.family === "IPv4" && !a.internal) return a.address;
		}
	}
	return "127.0.0.1";
}

registerWidget("speedtest", async (ctx, config): Promise<SpeedtestData> => {
	speedtestSchema.parse(config);
	const lastResult = getLastSpeedtestResult();
	let client = getCachedClient();

	if (!client && !lastResult) {
		try {
			const j = await fetchJson<{ isp?: string; query?: string }>(
				ctx,
				"http://ip-api.com/json",
				{ timeoutMs: 2000 },
				{ retries: 1 },
			);
			if (j.query || j.isp) {
				client = { isp: j.isp ?? "Local Network", ip: j.query ?? localIp() };
				setCachedClient(client);
			}
		} catch {
			client = { isp: "Local Network", ip: localIp() };
		}
	}

	return {
		lastResult,
		client: lastResult?.client ?? client ?? null,
	};
});
