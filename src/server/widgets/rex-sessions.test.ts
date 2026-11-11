import { describe, expect, it } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { __setRexRunner, fetchRexSessions, type RexRunner } from "./rex-sessions";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./rex-sessions";
import type { RexSessionsData } from "../../shared/widgets/payloads";

const LIST = { sessions: [{ session_id: "session:aaa", label: "main" }] };
const HOME = process.env.HOME ?? "/Users/yuzu";

const VIEW = {
	label: "main",
	active_window_id: "w2",
	windows: [
		{
			window_id: "w1",
			label: "Window one",
			focused_block_id: "b1",
			layers: [{ layer_id: "l1", blocks: [{ block_id: "b1", label: "shell" }] }],
		},
		{
			window_id: "w2",
			label: "Window two",
			focused_block_id: "b2",
			layers: [{ layer_id: "l2", blocks: [{ block_id: "b2", label: "editor" }] }],
		},
	],
};

function methodBody(block: string, method: string): unknown {
	if (block === "b1") {
		if (method === "title") return { title: "bun › rules" };
		if (method === "program_status")
			return {
				records: [
					{ state: "working", updated_at: "2026-11-11T10:00:00Z" },
					{ state: "done", updated_at: "2026-11-11T10:05:00Z" },
				],
			};
		if (method === "pwd") return { pwd: `file://host${HOME}/proj` };
		if (method === "process") return { foreground: { pid: 1, name: "bun" } };
	}
	if (method === "title") return { title: "nvim" };
	if (method === "program_status")
		return { records: [{ state: "blocked", updated_at: "2026-11-11T10:06:00Z" }] };
	if (method === "pwd") return { pwd: "/tmp" };
	if (method === "process") return { foreground: { pid: 2, name: "nvim" } };
	throw new Error(`unexpected ${block}/${method}`);
}

/** Routes `rex api call <method> <json>` to fixtures; records every call. */
function stubRunner(seen: string[] = [], view: unknown = VIEW, list: unknown = LIST): RexRunner {
	return async (args: string[]) => {
		seen.push(args.join(" "));
		const method = args[2];
		if (method === "session.list") return list;
		if (method === "session.view") return view;
		if (method === "block.method") {
			const parsed = JSON.parse(args[3] ?? "{}") as { block_id?: string; method?: string };
			return methodBody(parsed.block_id ?? "", parsed.method ?? "");
		}
		throw new Error(`unexpected method ${method}`);
	};
}

function makeCtx(): WidgetFetchContext {
	return {
		fetch: globalThis.fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	};
}

const fetcher = () => {
	const fn = serverWidgets.get("rex-sessions");
	if (!fn) throw new Error("expected rex-sessions fetcher");
	return fn;
};

describe("rex-sessions fetcher", () => {
	it("assembles sessions → windows → blocks with title, process, state and pwd", async () => {
		const data = (await fetchRexSessions(stubRunner(), { limit: 12 })) as RexSessionsData;
		// blocked sorts ahead of done — the widget's job is "what needs you".
		expect(data.blocks.map((b) => b.blockLabel)).toEqual(["editor", "shell"]);
		const ed = data.blocks[0];
		if (!ed) throw new Error("expected editor block");
		expect(ed.sessionLabel).toBe("main");
		expect(ed.windowLabel).toBe("Window two");
		expect(ed.title).toBe("nvim");
		expect(ed.process).toBe("nvim");
		expect(ed.state).toBe("blocked");
		expect(ed.updatedAt).toBe("2026-11-11T10:06:00Z");
		expect(ed.pwd).toBe("/tmp");
		expect(ed.focused).toBe(true);
		const sh = data.blocks[1];
		if (!sh) throw new Error("expected shell block");
		// Latest program_status record wins, and file:// + $HOME trims to ~/….
		expect(sh.state).toBe("done");
		expect(sh.updatedAt).toBe("2026-11-11T10:05:00Z");
		expect(sh.pwd).toBe("~/proj");
		expect(sh.process).toBe("bun");
	});

	it("calls only short block.method names and caps blocks at limit", async () => {
		const seen: string[] = [];
		const data = (await fetchRexSessions(stubRunner(seen), { limit: 1 })) as RexSessionsData;
		expect(data.blocks).toHaveLength(1);
		expect(data.blocks[0]?.blockLabel).toBe("editor");
		const methods = seen
			.filter((s) => s.includes("block.method"))
			.map((s) => JSON.parse(s.split(" ").at(-1) ?? "{}").method);
		expect(methods.length).toBeGreaterThan(0);
		for (const m of methods) expect(["title", "program_status", "pwd", "process"]).toContain(m);
	});

	it("marks the focused block per window", async () => {
		const data = (await fetchRexSessions(stubRunner(), { limit: 12 })) as RexSessionsData;
		expect(data.blocks.every((b) => b.focused)).toBe(true);
	});

	it("returns no blocks when rex lists no sessions", async () => {
		const data = (await fetchRexSessions(stubRunner([], VIEW, { sessions: [] }), {
			limit: 12,
		})) as RexSessionsData;
		expect(data.blocks).toEqual([]);
	});

	it("tolerates one block whose methods fail", async () => {
		const run: RexRunner = async (args: string[]) => {
			const method = args[2];
			if (method === "session.list") return LIST;
			if (method === "session.view") return VIEW;
			const parsed = JSON.parse(args[3] ?? "{}") as { block_id?: string; method?: string };
			if (parsed.block_id === "b2") throw new Error("rex-sessions: rex exited 1: gone");
			return methodBody(parsed.block_id ?? "", parsed.method ?? "");
		};
		const data = (await fetchRexSessions(run, { limit: 12 })) as RexSessionsData;
		expect(data.blocks).toHaveLength(2);
		const failed = data.blocks.find((b) => b.blockLabel === "editor");
		expect(failed?.state).toBe("unknown");
		expect(failed?.title).toBeNull();
	});

	it("registers and serves through the widget registry", async () => {
		__setRexRunner(stubRunner());
		try {
			const data = (await fetcher()(makeCtx(), { type: "rex-sessions" })) as RexSessionsData;
			expect(data.blocks).toHaveLength(2);
		} finally {
			__setRexRunner(null);
		}
	});

	it("throws when rex is missing or exits non-zero", async () => {
		const missing: RexRunner = async () => {
			throw new Error("rex-sessions: cannot run `rex` (not found) — is rex on PATH?");
		};
		await expect(fetchRexSessions(missing, { limit: 12 })).rejects.toThrow(/is rex on PATH/);
		const failing: RexRunner = async () => {
			throw new Error("rex-sessions: rex exited 1: connection refused");
		};
		await expect(fetchRexSessions(failing, { limit: 12 })).rejects.toThrow(/exited 1/);
	});
});
