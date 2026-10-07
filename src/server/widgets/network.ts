import * as os from "node:os";
import { NETWORK_DEFAULTS, networkSchema } from "../../shared/widgets/network";
import type { NetworkData } from "../../shared/widgets/payloads";
import { fetchJson, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

function localIp(): string {
	const ifs = os.networkInterfaces();
	for (const addrs of Object.values(ifs)) {
		if (!addrs) continue;
		for (const a of addrs) {
			if (a.family === "IPv4" && !a.internal) return a.address;
		}
	}
	return "—";
}

registerWidget("network", async (ctx, cfg) => {
	const c = networkSchema.parse(cfg);
	const showPublic =
		((c as Record<string, unknown>)["public-ip"] as boolean | undefined) ??
		NETWORK_DEFAULTS.publicIp;
	const pingTarget =
		((c as Record<string, unknown>)["ping-target"] as string | undefined) ??
		NETWORK_DEFAULTS.pingTarget;

	let publicIp: string | null = null;
	if (showPublic) {
		try {
			const j = await fetchJson<{ ip?: string }>(
				ctx,
				"https://api.ipify.org?format=json",
				{},
				retryOptionsFrom(c),
			);
			publicIp = j.ip ?? null;
		} catch {
			publicIp = null;
		}
	}

	// Time to first byte, not ping: the clock spans DNS, TCP, the TLS
	// handshake and the target's own time to answer. An error response is the
	// quickest answer a broken target can give, so it records no sample —
	// otherwise a dead host with a fast 503 charts as the best link here.
	let ttfbMs: number | null = null;
	try {
		const start = Date.now();
		const res = await ctx.fetch(`https://${pingTarget}/`, {
			method: "HEAD",
			signal: AbortSignal.timeout(3000),
		} as RequestInit);
		ttfbMs = res.ok ? Date.now() - start : null;
	} catch {
		ttfbMs = null;
	}
	const data: NetworkData = { localIp: localIp(), publicIp, ttfbMs };
	return data;
});
