import type {
	RexBlockState,
	RexSessionBlock,
	RexSessionsData,
} from "../../shared/widgets/payloads";
import { rexSessionsSchema } from "../../shared/widgets/rex-sessions";
import { isRecord } from "../../shared/is-record";
import { registerWidget } from "./registry";

/** `rex` speaks one binary protocol: `rex api call <method> <json-args>`. */
const REX_BIN = "rex";
const CALL_TIMEOUT_MS = 10_000;

function str(v: unknown): string | null {
	return typeof v === "string" && v.length > 0 ? v : null;
}

/** Array members narrowed to records — anything else is a shape we skip. */
function items(v: unknown): Record<string, unknown>[] {
	if (!Array.isArray(v)) return [];
	return v.filter(isRecord);
}

function field(o: Record<string, unknown>, key: string): unknown {
	return o[key];
}

/** Latest record wins — rex appends, so the max `updated_at` is the live one. */
function pickState(records: unknown): { state: RexBlockState; updatedAt: string | null } {
	let best: Record<string, unknown> | null = null;
	for (const r of items(records)) {
		if (best === null) {
			best = r;
			continue;
		}
		const a = str(field(r, "updated_at")) ?? "";
		const b = str(field(best, "updated_at")) ?? "";
		if (a > b) best = r;
	}
	const raw = best === null ? null : str(field(best, "state"));
	const state: RexBlockState =
		raw === "done" || raw === "working" || raw === "blocked" || raw === "failed" ? raw : "unknown";
	const updatedAt = best === null ? null : str(field(best, "updated_at"));
	return { state, updatedAt };
}

/** `file://host/Users/yuzu/x` → `~/x`; anything else passes through untouched. */
function trimPwd(pwd: string | null): string | null {
	if (!pwd) return null;
	const m = /^file:\/\/[^/]*(\/.*)$/.exec(pwd);
	const path = m ? (m[1] ?? pwd) : pwd;
	const home = process.env.HOME;
	if (home && (path === home || path.startsWith(`${home}/`))) return `~${path.slice(home.length)}`;
	return path;
}

export type RexRunner = (args: string[]) => Promise<unknown>;

/** Shells `rex api call`, the same way `rex ls` does — stdout is single-line
 * JSON when redirected. Bun rides the quota providers' `globalThis` seam so
 * vitest can stub the spawn without a real `rex` on PATH. Throws normally:
 * stale-on-error + the error banner handle the failure. */
export function makeRexRunner(): RexRunner {
	return async (args: string[]): Promise<unknown> => {
		const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
		if (!bun) throw new Error("rex-sessions: Bun runtime required to shell `rex`");
		// Same shape as speedtest.ts — the spawn must be declared before the try.
		let proc: ReturnType<typeof bun.spawn>;
		try {
			proc = bun.spawn([REX_BIN, ...args], { stdout: "pipe", stderr: "pipe" });
		} catch (e) {
			const hint = e instanceof Error ? e.message : String(e);
			throw new Error(`rex-sessions: cannot run \`rex\` (${hint}) — is rex on PATH?`);
		}
		if (!proc.stdout || typeof proc.stdout === "number") {
			try {
				proc.kill();
			} catch {}
			throw new Error("rex-sessions: failed to open rex stdout");
		}
		const timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {}
		}, CALL_TIMEOUT_MS);
		let out: string;
		try {
			out = await new Response(proc.stdout).text();
		} finally {
			clearTimeout(timer);
		}
		const code = await proc.exited;
		if (code !== 0) {
			let detail = "";
			if (proc.stderr && typeof proc.stderr !== "number") {
				try {
					detail = (await new Response(proc.stderr).text()).trim().split("\n")[0] ?? "";
				} catch {}
			}
			throw new Error(`rex-sessions: rex exited ${code}${detail ? `: ${detail}` : ""}`);
		}
		try {
			return JSON.parse(out) as unknown;
		} catch {
			throw new Error("rex-sessions: rex returned unparseable JSON");
		}
	};
}

/** Default runner, swapped for a fixture stub in tests via `__setRexRunner`. */
let runner: RexRunner | null = null;

function getRunner(): RexRunner {
	if (!runner) runner = makeRexRunner();
	return runner;
}

/** Test seam: replace the `rex` subprocess with canned JSON. */
export function __setRexRunner(next: RexRunner | null): void {
	runner = next;
}

async function callMethod(
	run: RexRunner,
	method: string,
	args: Record<string, string>,
): Promise<unknown> {
	return run(["api", "call", method, JSON.stringify(args)]);
}

interface FlatBlock {
	sessionId: string;
	sessionLabel: string;
	windowLabel: string;
	blockId: string;
	blockLabel: string;
	focused: boolean;
}

function flattenView(sessionId: string, sessionLabel: string, view: unknown): FlatBlock[] {
	const out: FlatBlock[] = [];
	if (!isRecord(view)) return out;
	for (const w of items(field(view, "windows"))) {
		const windowLabel = str(field(w, "label")) ?? "window";
		const focusedId = str(field(w, "focused_block_id"));
		for (const l of items(field(w, "layers"))) {
			for (const b of items(field(l, "blocks"))) {
				const blockId = str(field(b, "block_id"));
				if (!blockId) continue;
				out.push({
					sessionId,
					sessionLabel,
					windowLabel,
					blockId,
					blockLabel: str(field(b, "label")) ?? "block",
					focused: focusedId !== null && focusedId === blockId,
				});
			}
		}
	}
	return out;
}

async function enrichBlock(run: RexRunner, b: FlatBlock): Promise<RexSessionBlock> {
	const base = { session_id: b.sessionId, block_id: b.blockId };
	// Fan out per block — one block's missing method must not sink the row.
	const [titleR, statusR, pwdR, procR] = await Promise.allSettled([
		callMethod(run, "block.method", { ...base, method: "title" }),
		callMethod(run, "block.method", { ...base, method: "program_status" }),
		callMethod(run, "block.method", { ...base, method: "pwd" }),
		callMethod(run, "block.method", { ...base, method: "process" }),
	]);
	const title =
		titleR.status === "fulfilled" && isRecord(titleR.value)
			? str(field(titleR.value, "title"))
			: null;
	const { state, updatedAt } =
		statusR.status === "fulfilled" && isRecord(statusR.value)
			? pickState(field(statusR.value, "records"))
			: { state: "unknown" as RexBlockState, updatedAt: null as string | null };
	const pwd =
		pwdR.status === "fulfilled" && isRecord(pwdR.value)
			? trimPwd(str(field(pwdR.value, "pwd")))
			: null;
	const fgRaw =
		procR.status === "fulfilled" && isRecord(procR.value) ? field(procR.value, "foreground") : null;
	const fg = isRecord(fgRaw) ? str(field(fgRaw, "name")) : null;
	return {
		blockId: b.blockId,
		sessionId: b.sessionId,
		sessionLabel: b.sessionLabel,
		windowLabel: b.windowLabel,
		blockLabel: b.blockLabel,
		title,
		process: fg,
		state,
		updatedAt,
		pwd,
		focused: b.focused,
	};
}

/** Blocked panes surface first — the widget's job is "what needs you". */
const STATE_RANK: Record<RexBlockState, number> = {
	blocked: 0,
	failed: 1,
	working: 2,
	unknown: 3,
	done: 4,
};

export async function fetchRexSessions(
	run: RexRunner,
	cfg: { limit: number },
): Promise<RexSessionsData> {
	const list = await callMethod(run, "session.list", {});
	const sessions = (isRecord(list) ? items(field(list, "sessions")) : [])
		.map((s) => ({ id: str(field(s, "session_id")), label: str(field(s, "label")) }))
		.filter((s): s is { id: string; label: string | null } => s.id !== null);
	if (sessions.length === 0) return { blocks: [] };

	// Views in parallel — sessions are independent; per-block fan-out below.
	const views = await Promise.all(
		sessions.map((s) => callMethod(run, "session.view", { session_id: s.id })),
	);
	const flat = views.flatMap((v, i) => {
		const s = sessions[i];
		if (!s) return [];
		return flattenView(s.id, s.label ?? s.id, v);
	});
	const blocks = await Promise.all(flat.map((b) => enrichBlock(run, b)));
	blocks.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
	return { blocks: blocks.slice(0, cfg.limit) };
}

registerWidget("rex-sessions", async (_ctx, config): Promise<RexSessionsData> => {
	const cfg = rexSessionsSchema.parse(config);
	return fetchRexSessions(getRunner(), cfg);
});
