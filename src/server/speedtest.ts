import type { SpeedtestResult } from "../shared/widgets/payloads";

export type SpeedtestStreamEvent =
	| { type: "init" }
	| { type: "client"; isp: string; ip: string }
	| { type: "server"; name: string; location: string; ping: number }
	| { type: "phase"; phase: "ping" | "download" | "upload" }
	| { type: "progress"; phase: "download" | "upload"; dots: number }
	| { type: "download"; speed: number }
	| { type: "upload"; speed: number }
	| { type: "done"; result: SpeedtestResult }
	| { type: "error"; error: string };

let lastResult: SpeedtestResult | null = null;

export function getLastSpeedtestResult(): SpeedtestResult | null {
	return lastResult;
}

export function setLastSpeedtestResult(res: SpeedtestResult): void {
	lastResult = res;
}

export async function runSpeedtest(
	emit: (event: SpeedtestStreamEvent) => void,
	signal?: AbortSignal,
): Promise<SpeedtestResult | null> {
	emit({ type: "init" });

	let proc: ReturnType<typeof Bun.spawn>;
	try {
		proc = Bun.spawn(["speedtest-cli"], {
			stdout: "pipe",
			stderr: "pipe",
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "speedtest-cli executable not found";
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

	const result: SpeedtestResult = {
		download: 0,
		upload: 0,
		ping: 0,
		client: { isp: "", ip: "" },
		server: { name: "", sponsor: "", host: "" },
		timestamp: new Date().toISOString(),
	};

	if (!proc.stdout || typeof proc.stdout === "number") {
		emit({ type: "error", error: "failed to open speedtest stdout" });
		return null;
	}
	const reader = proc.stdout.getReader();
	const dec = new TextDecoder();
	let stdoutText = "";
	let currentPhase: "ping" | "download" | "upload" = "ping";
	let downloadDots = 0;
	let uploadDots = 0;

	try {
		while (true) {
			if (signal?.aborted) {
				try {
					proc.kill();
				} catch {}
				break;
			}

			const { done, value } = await reader.read();
			if (done) break;

			const chunk = dec.decode(value);
			stdoutText += chunk;

			// Parse client: "Testing from StarHub (39.109.255.32)..."
			const clientMatch = stdoutText.match(/Testing from (.*?) \((.*?)\)/);
			if (clientMatch && !result.client?.isp) {
				const isp = clientMatch[1].trim();
				const ip = clientMatch[2].trim();
				result.client = { isp, ip };
				emit({ type: "client", isp, ip });
			}

			// Parse server: "Hosted by fdcservers.net (Singapore) [13.77 km]: 7.093 ms"
			const serverMatch = stdoutText.match(
				/Hosted by (.*?) \((.*?)\)(?: \[[^\]]+\])?: ([\d.]+) ms/,
			);
			if (serverMatch && !result.ping) {
				const name = serverMatch[1].trim();
				const location = serverMatch[2].trim();
				const ping = Number.parseFloat(serverMatch[3]);
				result.server = { name, sponsor: name, country: location };
				result.ping = ping;
				emit({ type: "server", name, location, ping });
			}

			// Download phase
			if (chunk.includes("Testing download")) {
				currentPhase = "download";
				emit({ type: "phase", phase: "download" });
			}
			if (currentPhase === "download") {
				const dotsInChunk = (chunk.match(/\./g) || []).length;
				if (dotsInChunk > 0) {
					downloadDots += dotsInChunk;
					emit({ type: "progress", phase: "download", dots: downloadDots });
				}
			}
			const dlMatch = stdoutText.match(/Download:\s*([\d.]+)\s*Mbit\/s/i);
			if (dlMatch && !result.download) {
				result.download = Number.parseFloat(dlMatch[1]);
				emit({ type: "download", speed: result.download });
			}

			// Upload phase
			if (chunk.includes("Testing upload")) {
				currentPhase = "upload";
				emit({ type: "phase", phase: "upload" });
			}
			if (currentPhase === "upload") {
				const dotsInChunk = (chunk.match(/\./g) || []).length;
				if (dotsInChunk > 0) {
					uploadDots += dotsInChunk;
					emit({ type: "progress", phase: "upload", dots: uploadDots });
				}
			}
			const ulMatch = stdoutText.match(/Upload:\s*([\d.]+)\s*Mbit\/s/i);
			if (ulMatch && !result.upload) {
				result.upload = Number.parseFloat(ulMatch[1]);
				emit({ type: "upload", speed: result.upload });
			}
		}

		await proc.exited;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		emit({ type: "error", error: msg });
		return null;
	}

	result.timestamp = new Date().toISOString();
	if (result.download || result.upload) {
		lastResult = result;
		emit({ type: "done", result });
		return result;
	}

	return null;
}
