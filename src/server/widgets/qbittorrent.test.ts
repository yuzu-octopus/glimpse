import { describe, expect, it, vi } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./qbittorrent";
import { qbittorrentSchema } from "../../shared/widgets/media";
import type { TorrentData } from "../../shared/widgets/payloads";

const INFO_FIXTURE = [
	{
		name: "ubuntu.iso",
		progress: 0.42,
		state: "downloading",
		size: 4_000_000_000,
		dlspeed: 12_000_000,
		upspeed: 0,
		eta: 300,
	},
	{
		name: "done.mkv",
		progress: 1,
		state: "uploading",
		size: 800_000_000,
		dlspeed: 0,
		upspeed: 500_000,
		eta: 8640000,
	},
];

function makeCtx(
	fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
	env: Record<string, string | undefined> = {},
): WidgetFetchContext {
	return {
		fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
		env,
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	};
}

function okRouter(url: string): Response {
	if (url.endsWith("/api/v2/auth/login")) {
		return new Response("Ok.", { status: 200, headers: { "set-cookie": "SID=abc123; path=/" } });
	}
	return new Response(JSON.stringify(INFO_FIXTURE), { status: 200 });
}

const fetcher = () => serverWidgets.get("qbittorrent")!;

describe("qbittorrent fetcher", () => {
	it("logs in then maps torrent info with clamped progress", async () => {
		const ctx = makeCtx(async (url) => okRouter(url));
		const data = (await fetcher()(ctx, {
			type: "qbittorrent",
			url: "http://qb.lab:8080",
		})) as TorrentData;
		expect(data.torrents).toHaveLength(2);
		expect(data.torrents[0]).toEqual({
			name: "ubuntu.iso",
			progress: 0.42,
			state: "downloading",
			size: 4_000_000_000,
			downloadSpeed: 12_000_000,
			uploadSpeed: 0,
			eta: 300,
		});
		// qbit sentinel eta (8640000 = unknown) becomes null
		expect(data.torrents[1].eta).toBeNull();
		expect(data.torrents[1].progress).toBe(1);
	});

	it("throws on login failure", async () => {
		const ctx = makeCtx(async (url) =>
			url.endsWith("/api/v2/auth/login")
				? new Response("Fails.", { status: 200 })
				: new Response("[]", { status: 200 }),
		);
		await expect(
			fetcher()(ctx, { type: "qbittorrent", url: "http://qb.lab:8080" }),
		).rejects.toThrow(/login failed/i);
	});

	it("applies the limit", async () => {
		const ctx = makeCtx(async (url) => okRouter(url));
		const data = (await fetcher()(ctx, {
			type: "qbittorrent",
			url: "http://qb.lab:8080",
			limit: 1,
		})) as TorrentData;
		expect(data.torrents).toHaveLength(1);
	});

	it("logs in with the env credentials and ignores ones left in the config", async () => {
		const bodies: string[] = [];
		const ctx = makeCtx(
			async (url, init) => {
				if (url.endsWith("/api/v2/auth/login")) bodies.push(String(init?.body));
				return okRouter(url);
			},
			{ QBITTORRENT_USERNAME: "envuser", QBITTORRENT_PASSWORD: "envpass" },
		);
		await fetcher()(ctx, {
			type: "qbittorrent",
			url: "http://qb.lab:8080",
			username: "leaked",
			password: "leaked",
		});
		expect(bodies[0]).toContain("envuser");
		expect(bodies[0]).toContain("envpass");
		expect(bodies[0]).not.toContain("leaked");
		const parsed = qbittorrentSchema.parse({
			type: "qbittorrent",
			url: "http://qb.lab:8080",
			username: "leaked",
			password: "leaked",
		});
		expect(JSON.stringify(parsed)).not.toContain("leaked");
	});
});
