import type { SpeedtestResult } from "../shared/widgets/payloads";

export type SpeedtestStreamEvent =
	| { type: "init" }
	| { type: "client"; isp: string; ip: string }
	| { type: "server"; name: string; location: string; ping: number }
	| { type: "phase"; phase: "ping" | "download" | "upload" }
	| { type: "progress"; phase: "download" | "upload"; speed: number }
	| { type: "download"; speed: number }
	| { type: "upload"; speed: number }
	| { type: "done"; result: SpeedtestResult }
	| { type: "error"; error: string };

let lastResult: SpeedtestResult | null = null;
let cachedClient: { isp: string; ip: string } | null = null;

export function getLastSpeedtestResult(): SpeedtestResult | null {
	return lastResult;
}

export function setLastSpeedtestResult(res: SpeedtestResult): void {
	lastResult = res;
	if (res.client?.isp && res.client?.ip) {
		cachedClient = { isp: res.client.isp, ip: res.client.ip };
	}
}

export function getCachedClient(): { isp: string; ip: string } | null {
	if (lastResult?.client?.isp) {
		return { isp: lastResult.client.isp, ip: lastResult.client.ip ?? "" };
	}
	return cachedClient;
}

export function setCachedClient(client: { isp: string; ip: string } | null): void {
	cachedClient = client;
}

async function runNativeSpeedtest(
	emit: (event: SpeedtestStreamEvent) => void,
	signal?: AbortSignal,
): Promise<SpeedtestResult | null> {
	// 1. Client & Server identification
	let clientIp = "Local";
	let serverLoc = "Edge (Global)";
	try {
		const traceRes = await fetch("https://1.1.1.1/cdn-cgi/trace", {
			signal: signal
				? AbortSignal.any([signal, AbortSignal.timeout(2000)])
				: AbortSignal.timeout(2000),
		});
		if (traceRes.ok) {
			const traceText = await traceRes.text();
			const ipMatch = traceText.match(/ip=(.*)/);
			const coloMatch = traceText.match(/colo=(.*)/);
			const locMatch = traceText.match(/loc=(.*)/);
			if (ipMatch) clientIp = ipMatch[1].trim();
			serverLoc = `${coloMatch ? coloMatch[1].trim() : "Edge"} (${locMatch ? locMatch[1].trim() : "Global"})`;
		}
	} catch {}

	let clientIsp = cachedClient?.isp || "Broadband";
	if (!cachedClient?.isp) {
		try {
			const geoRes = await fetch("http://ip-api.com/json", { signal: AbortSignal.timeout(1500) });
			if (geoRes.ok) {
				const geo = (await geoRes.json()) as { isp?: string; query?: string };
				if (geo.isp) clientIsp = geo.isp;
				if (geo.query && clientIp === "Local") clientIp = geo.query;
			}
		} catch {}
	}

	cachedClient = { isp: clientIsp, ip: clientIp };
	emit({ type: "client", isp: clientIsp, ip: clientIp });

	if (signal?.aborted) return null;

	// 2. Ping phase
	emit({ type: "phase", phase: "ping" });
	const pingTasks = [0, 1, 2].map(async () => {
		const pStart = performance.now();
		try {
			const pRes = await fetch("https://speed.cloudflare.com/__down?bytes=0", {
				signal: AbortSignal.timeout(2000),
			});
			if (pRes.ok) return performance.now() - pStart;
		} catch {}
		return null;
	});
	const pingResults = (await Promise.all(pingTasks)).filter((p): p is number => p !== null);
	pingResults.sort((a, b) => a - b);
	const bestPing = Math.round(pingResults[0] || 15);
	emit({ type: "server", name: "Cloudflare Anycast", location: serverLoc, ping: bestPing });

	if (signal?.aborted) return null;

	// 3. Download phase — measure actual live throughput across real bytes
	emit({ type: "phase", phase: "download" });
	const dlStart = performance.now();
	const dlBytesTarget = 35_000_000; // 35MB
	const dlRes = await fetch(`https://speed.cloudflare.com/__down?bytes=${dlBytesTarget}`, {
		signal: signal
			? AbortSignal.any([signal, AbortSignal.timeout(12000)])
			: AbortSignal.timeout(12000),
	});

	if (!dlRes.body) throw new Error("No download stream body");
	const reader = dlRes.body.getReader();
	let dlBytes = 0;
	let lastProgressTime = 0;

	while (true) {
		if (signal?.aborted) {
			await reader.cancel();
			return null;
		}
		const { done, value } = await reader.read();
		if (done) break;
		dlBytes += value.length;
		const now = performance.now();
		if (now - lastProgressTime >= 90) {
			lastProgressTime = now;
			const elapsedSec = (now - dlStart) / 1000;
			const liveMbps = (dlBytes * 8) / (elapsedSec * 1_000_000);
			emit({ type: "progress", phase: "download", speed: Math.round(liveMbps * 10) / 10 });
		}
	}

	// `Math.max(ms, 1)` guards a divide-by-zero on a transfer that completes
	// inside the clock's resolution (a cached/local edge) — Infinity Mbps would
	// then poison the result and the needle.
	const dlDurationSec = Math.max(performance.now() - dlStart, 1) / 1000;
	const finalDownload = Math.round(((dlBytes * 8) / (dlDurationSec * 1_000_000)) * 10) / 10;
	emit({ type: "download", speed: finalDownload });

	if (signal?.aborted) return null;

	// 4. Upload phase
	emit({ type: "phase", phase: "upload" });
	const ulBytes = 12_000_000; // 12MB
	const ulPayload = new Uint8Array(ulBytes);
	const ulStart = performance.now();
	let uploadFinished = false;

	// Periodic progress estimate during upload
	const ulTimer = setInterval(() => {
		if (uploadFinished || signal?.aborted) {
			clearInterval(ulTimer);
			return;
		}
		const elapsedSec = (performance.now() - ulStart) / 1000;
		if (elapsedSec > 0.1) {
			const estMbps = Math.min(finalDownload * 0.8, (ulBytes * 0.5 * 8) / (elapsedSec * 1_000_000));
			emit({ type: "progress", phase: "upload", speed: Math.round(estMbps * 10) / 10 });
		}
	}, 100);

	try {
		await fetch("https://speed.cloudflare.com/__up", {
			method: "POST",
			body: ulPayload,
			signal: signal
				? AbortSignal.any([signal, AbortSignal.timeout(10000)])
				: AbortSignal.timeout(10000),
		});
	} finally {
		uploadFinished = true;
		clearInterval(ulTimer);
	}

	const ulDurationSec = Math.max(performance.now() - ulStart, 1) / 1000;
	const finalUpload = Math.round(((ulBytes * 8) / (ulDurationSec * 1_000_000)) * 10) / 10;
	emit({ type: "upload", speed: finalUpload });

	// 5. Done
	const result: SpeedtestResult = {
		download: finalDownload,
		upload: finalUpload,
		ping: bestPing,
		client: { isp: clientIsp, ip: clientIp },
		server: { name: "Cloudflare Anycast", country: serverLoc, sponsor: "Cloudflare" },
		timestamp: new Date().toISOString(),
	};

	lastResult = result;
	emit({ type: "done", result });
	return result;
}

async function runCliSpeedtestFallback(
	emit: (event: SpeedtestStreamEvent) => void,
	signal?: AbortSignal,
): Promise<SpeedtestResult | null> {
	let proc: ReturnType<typeof Bun.spawn>;
	try {
		proc = Bun.spawn(["speedtest-cli", "--json"], {
			stdout: "pipe",
			stderr: "pipe",
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "speedtest tool not found";
		emit({ type: "error", error: msg });
		return null;
	}

	if (signal) {
		signal.addEventListener("abort", () => {
			try {
				proc.kill();
			} catch {}
		});
	}
	// Every exit below must reap the child: the abort listener is the only other
	// killer and it never fires when the failure is ours, not a cancellation.
	if (!proc.stdout || typeof proc.stdout === "number") {
		try {
			proc.kill();
		} catch {}
		emit({ type: "error", error: "failed to open speedtest stdout" });
		return null;
	}

	try {
		const out = await new Response(proc.stdout).text();
		await proc.exited;
		const j = JSON.parse(out);
		const download = Math.round(((j.download || 0) / 1_000_000) * 10) / 10;
		const upload = Math.round(((j.upload || 0) / 1_000_000) * 10) / 10;
		const ping = Math.round(j.ping || 0);
		const result: SpeedtestResult = {
			download,
			upload,
			ping,
			client: { isp: j.client?.isp || "Local", ip: j.client?.ip || "" },
			server: {
				name: j.server?.name || "Server",
				country: j.server?.country || "",
				sponsor: j.server?.sponsor || "",
			},
			timestamp: new Date().toISOString(),
		};
		lastResult = result;
		emit({ type: "done", result });
		return result;
	} catch (err) {
		try {
			proc.kill();
		} catch {}
		const msg = err instanceof Error ? err.message : String(err);
		emit({ type: "error", error: msg });
		return null;
	}
}

export async function runSpeedtest(
	emit: (event: SpeedtestStreamEvent) => void,
	signal?: AbortSignal,
): Promise<SpeedtestResult | null> {
	emit({ type: "init" });
	try {
		const nativeRes = await runNativeSpeedtest(emit, signal);
		if (nativeRes) return nativeRes;
	} catch (nativeErr) {
		console.warn("Native speedtest error, falling back to CLI:", nativeErr);
	}
	return runCliSpeedtestFallback(emit, signal);
}
