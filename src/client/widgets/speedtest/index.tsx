import { ArrowDown, ArrowUp, RefreshCw, Server, Wifi, Zap } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import type { SpeedtestData, SpeedtestResult } from "../../../shared/widgets/payloads";
import type { SpeedtestConfig } from "../../../shared/widgets/speedtest";
import { WidgetChrome } from "../../components/WidgetChrome";
import { registerWidgetComponent, type WidgetComponentProps } from "../registry";
import styles from "./speedtest.module.css";

const TICKS = [
	{ speed: 0, frac: 0, label: "0" },
	{ speed: 5, frac: 0.1, label: "5" },
	{ speed: 10, frac: 0.2, label: "10" },
	{ speed: 50, frac: 0.35, label: "50" },
	{ speed: 100, frac: 0.5, label: "100" },
	{ speed: 250, frac: 0.65, label: "250" },
	{ speed: 500, frac: 0.8, label: "500" },
	{ speed: 750, frac: 0.9, label: "750" },
	{ speed: 1000, frac: 1.0, label: "1000" },
];

function speedToFraction(speed: number): number {
	if (speed <= 0) return 0;
	if (speed >= 1000) return 1;
	for (let i = 0; i < TICKS.length - 1; i++) {
		const cur = TICKS[i];
		const next = TICKS[i + 1];
		if (speed >= cur.speed && speed <= next.speed) {
			const t = (speed - cur.speed) / (next.speed - cur.speed);
			return cur.frac + t * (next.frac - cur.frac);
		}
	}
	return 1;
}

const CX = 120;
const CY = 100;
const R = 78;
const ARC_LEN = 2 * Math.PI * R * (240 / 360); // ~326.7px
const NEEDLE_LEN = 42;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = (angleDeg * Math.PI) / 180;
	return {
		x: cx + r * Math.cos(rad),
		y: cy + r * Math.sin(rad),
	};
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
	const start = polarToCartesian(cx, cy, r, startAngle);
	const end = polarToCartesian(cx, cy, r, endAngle);
	return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

const ARC_PATH = describeArc(CX, CY, R, 150, 390);

interface SpeedometerProps {
	speed: number;
	phase: "ping" | "download" | "upload" | "idle" | "done";
}

function Speedometer({ speed, phase }: SpeedometerProps) {
	const gradId = useId();
	const frac = speedToFraction(speed);
	const rotation = -120 + frac * 240;
	const strokeOffset = ARC_LEN * (1 - frac);
	const isUpload = phase === "upload";

	return (
		<div className={styles.gaugeWrapper}>
			<svg viewBox="0 0 240 170" className={styles.gaugeSvg}>
				<title>Internet connection speed gauge</title>
				<defs>
					<linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="var(--color-primary, #8be9fd)" />
						<stop
							offset="100%"
							stopColor={
								isUpload ? "var(--color-text-accent, #bd93f9)" : "var(--color-positive, #50fa7b)"
							}
						/>
					</linearGradient>
				</defs>

				{/* Background track */}
				<path
					d={ARC_PATH}
					fill="none"
					stroke="rgba(255, 255, 255, 0.08)"
					strokeWidth="12"
					strokeLinecap="round"
				/>

				{/* Active colored arc */}
				<path
					d={ARC_PATH}
					fill="none"
					stroke={`url(#${gradId})`}
					strokeWidth="12"
					strokeLinecap="round"
					strokeDasharray={ARC_LEN}
					strokeDashoffset={strokeOffset}
					style={{ transition: "stroke-dashoffset 0.25s ease-out" }}
				/>

				{/* Scale Ticks and Labels (inside radius R - 16 = 62) */}
				{TICKS.map((t) => {
					const tickAngle = 150 + t.frac * 240;
					const tickPos = polarToCartesian(CX, CY, R - 16, tickAngle);
					return (
						<text
							key={t.speed}
							x={tickPos.x}
							y={tickPos.y}
							fill="var(--color-text-base-muted)"
							fontSize="8.5"
							fontWeight="600"
							textAnchor="middle"
							dominantBaseline="central"
						>
							{t.label}
						</text>
					);
				})}

				{/* Smoothly rotating needle (stops 20px before the numbers) */}
				<g
					style={{
						transform: `rotate(${rotation}deg)`,
						transformOrigin: `${CX}px ${CY}px`,
						transition: "transform 0.28s cubic-bezier(0.12, 0.95, 0.2, 1)",
					}}
				>
					<polygon
						points={`${CX - 3.5},${CY} ${CX},${CY - NEEDLE_LEN} ${CX + 3.5},${CY}`}
						fill="var(--color-text-highlight, #f8f8f2)"
					/>
				</g>

				{/* Center Needle Hub */}
				<circle cx={CX} cy={CY} r="6" fill="var(--color-text-highlight, #f8f8f2)" />
				<circle cx={CX} cy={CY} r="3" fill="var(--color-background, #282a36)" />
			</svg>

			{/* Digital speed readout */}
			<div className={styles.digitalReadout}>
				<span className={styles.digitalSpeed}>{speed.toFixed(2)}</span>
				<span className={styles.digitalUnit}>
					{isUpload ? (
						<ArrowUp size={11} className={styles.uploadColor} />
					) : (
						<ArrowDown size={11} className={styles.downloadColor} />
					)}
					Mbps
				</span>
			</div>
		</div>
	);
}

async function streamSpeedtestRun(onEvent: (evt: Record<string, unknown>) => void): Promise<void> {
	const res = await fetch("/api/speedtest/run", { method: "POST" });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const reader = res.body?.getReader();
	if (!reader) throw new Error("No readable stream");

	const dec = new TextDecoder();
	let buf = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buf += dec.decode(value, { stream: true });
		const lines = buf.split("\n");
		buf = lines.pop() ?? "";

		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				onEvent(JSON.parse(line));
			} catch {}
		}
	}
}
function applyStreamEvent(
	evt: Record<string, unknown>,
	active: SpeedtestResult,
	actions: {
		setPhase: (p: "ping" | "download" | "upload" | "idle" | "done") => void;
		setCurrentSpeed: (s: number) => void;
		setStatusMessage: (m: string) => void;
		setResult: (r: SpeedtestResult) => void;
	},
) {
	const type = evt.type;
	if (type === "client") {
		active.client = { isp: String(evt.isp), ip: String(evt.ip) };
	} else if (type === "server") {
		active.server = { name: String(evt.name), country: String(evt.location) };
		active.ping = Number(evt.ping);
		actions.setStatusMessage(`Ping: ${evt.ping} ms`);
	} else if (type === "phase") {
		actions.setPhase(evt.phase as "ping" | "download" | "upload");
		actions.setStatusMessage(`Testing ${evt.phase}...`);
	} else if (type === "progress") {
		const dots = Number(evt.dots ?? 1);
		const est = evt.phase === "download" ? Math.min(1000, dots * 8) : Math.min(800, dots * 6);
		actions.setCurrentSpeed(est);
	} else if (type === "download") {
		active.download = Number(evt.speed);
		actions.setCurrentSpeed(active.download);
		actions.setStatusMessage(`Download: ${evt.speed} Mbps`);
	} else if (type === "upload") {
		active.upload = Number(evt.speed);
		actions.setCurrentSpeed(active.upload);
		actions.setStatusMessage(`Upload: ${evt.speed} Mbps`);
	} else if (type === "done") {
		const res = evt.result as SpeedtestResult;
		actions.setResult(res);
		actions.setCurrentSpeed(res.download || res.upload);
		actions.setPhase("done");
		actions.setStatusMessage("Complete");
	} else if (type === "error") {
		actions.setStatusMessage(String(evt.error));
	}
}

function MetricKpi({
	label,
	value,
	icon,
	colorClass,
}: {
	label: string;
	value: string;
	icon: ReactNode;
	colorClass: string;
}) {
	return (
		<div className={styles.kpi}>
			<span className={styles.kpiLabel}>
				{icon} {label}
			</span>
			<span className={`${styles.kpiValue} ${colorClass}`}>{value}</span>
		</div>
	);
}

function SpeedtestTopBar({ result }: { result: SpeedtestResult | null }) {
	const dlText = result?.download ? `${result.download.toFixed(1)} Mbps` : "—";
	const ulText = result?.upload ? `${result.upload.toFixed(1)} Mbps` : "—";
	const pingText = result?.ping ? `${result.ping.toFixed(1)} ms` : "—";

	return (
		<div className={styles.topBar}>
			<MetricKpi
				label="Download"
				value={dlText}
				icon={<ArrowDown size={12} className={styles.downloadColor} />}
				colorClass={styles.downloadColor}
			/>
			<MetricKpi
				label="Upload"
				value={ulText}
				icon={<ArrowUp size={12} className={styles.uploadColor} />}
				colorClass={styles.uploadColor}
			/>
			<MetricKpi
				label="Ping"
				value={pingText}
				icon={<Zap size={12} className={styles.pingColor} />}
				colorClass={styles.pingColor}
			/>
		</div>
	);
}

function SpeedtestBottomBar({
	client,
	server,
}: {
	client?: { isp?: string; ip?: string } | null;
	server?: { sponsor?: string; name?: string; country?: string } | null;
}) {
	const ispName = client?.isp || "Local Network";
	const ipAddr = client?.ip || "";
	const serverName = server?.sponsor || server?.name || "—";
	const serverLoc = server?.country || "—";

	return (
		<div className={styles.bottomBar}>
			<div className={styles.metaCol}>
				<Wifi size={14} className={styles.metaIcon} />
				<div className={styles.metaText}>
					<div className={styles.metaPrimary}>{ispName}</div>
					{ipAddr ? <div className={styles.metaSecondary}>{ipAddr}</div> : null}
				</div>
			</div>
			<div className={styles.metaCol}>
				<Server size={14} className={styles.metaIcon} />
				<div className={styles.metaText}>
					<div className={styles.metaPrimary}>{serverName}</div>
					<div className={styles.metaSecondary}>{serverLoc}</div>
				</div>
			</div>
		</div>
	);
}

function Speedtest({ config, data, error, isLoading }: WidgetComponentProps) {
	const cfg = config as unknown as SpeedtestConfig;
	const payload = data as SpeedtestData | null;

	const [result, setResult] = useState<SpeedtestResult | null>(() => payload?.lastResult ?? null);
	const [running, setRunning] = useState(false);
	const [phase, setPhase] = useState<"ping" | "download" | "upload" | "idle" | "done">("idle");
	const [currentSpeed, setCurrentSpeed] = useState(0);
	const [statusMessage, setStatusMessage] = useState("");

	const inFlightRef = useRef(false);

	const startSpeedtest = async () => {
		if (inFlightRef.current || running) return;
		inFlightRef.current = true;
		setRunning(true);
		setPhase("ping");
		setCurrentSpeed(0);
		setStatusMessage("Connecting to server...");

		const active: SpeedtestResult = {
			download: 0,
			upload: 0,
			ping: 0,
			client: result?.client ?? { isp: "Local", ip: "" },
			server: result?.server ?? { name: "Selecting...", sponsor: "" },
			timestamp: new Date().toISOString(),
		};

		try {
			await streamSpeedtestRun((evt) =>
				applyStreamEvent(evt, active, {
					setPhase,
					setCurrentSpeed,
					setStatusMessage,
					setResult,
				}),
			);
		} catch (err) {
			setStatusMessage(err instanceof Error ? err.message : "Test failed");
		} finally {
			inFlightRef.current = false;
			setRunning(false);
			if (phase !== "done") setPhase(result ? "done" : "idle");
		}
	};

	const showGauge = running || phase === "done" || result !== null;

	return (
		<WidgetChrome
			title={cfg.title ?? "Speedtest"}
			titleUrl={cfg["title-url"]}
			hideHeader={cfg["hide-header"]}
			cssClass={cfg["css-class"]}
			isLoading={isLoading}
			error={error}
			showErrors={cfg["show-errors"]}
		>
			<div className={styles.container}>
				<SpeedtestTopBar result={result} />

				{/* Center Stage: Either GO button or Speedometer */}
				<div className={styles.centerStage}>
					{!showGauge ? (
						<button
							type="button"
							className={styles.goButton}
							onClick={startSpeedtest}
							disabled={running}
							aria-label="Start speed test"
						>
							GO
						</button>
					) : (
						<>
							<Speedometer speed={currentSpeed} phase={phase} />
							<div className={styles.actionRow}>
								{running ? (
									<div
										className={`${styles.beacon} ${
											phase === "download"
												? styles.beaconDownload
												: phase === "upload"
													? styles.beaconUpload
													: styles.beaconPing
										}`}
									/>
								) : (
									<button type="button" className={styles.retestButton} onClick={startSpeedtest}>
										<RefreshCw size={11} /> Test Again
									</button>
								)}
								<span className={styles.statusText}>{statusMessage}</span>
							</div>
						</>
					)}
				</div>

				<SpeedtestBottomBar client={result?.client ?? payload?.client} server={result?.server} />
			</div>
		</WidgetChrome>
	);
}

registerWidgetComponent("speedtest", Speedtest);

export default Speedtest;
