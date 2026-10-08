import { describe, expect, it } from "vitest";
import { Singleflight, TtlCache } from "../cache";
import { serverWidgets, type WidgetFetchContext } from "./registry";
import "./speedtest";
import type { SpeedtestData } from "../../shared/widgets/payloads";
import { setLastSpeedtestResult } from "../speedtest";

const speedtestFetcher = () => {
	const fn = serverWidgets.get("speedtest");
	if (!fn) throw new Error("speedtest fetcher missing");
	return fn;
};

function makeMockCtx(): WidgetFetchContext {
	return {
		fetch: globalThis.fetch,
		env: {},
		cache: new TtlCache(),
		singleflight: new Singleflight(),
	};
}

describe("speedtest fetcher", () => {
	it("returns null lastResult when no test has run", async () => {
		const ctx = makeMockCtx();
		const data = (await speedtestFetcher()(ctx, {
			type: "speedtest",
		})) as SpeedtestData;

		expect(data).toHaveProperty("lastResult");
	});

	it("returns cached lastResult after test completion", async () => {
		setLastSpeedtestResult({
			download: 850.5,
			upload: 620.2,
			ping: 7.2,
			client: { isp: "StarHub", ip: "39.109.255.32" },
			server: { name: "Singapore", sponsor: "fdcservers.net" },
			timestamp: "2026-10-08T10:00:00Z",
		});

		const ctx = makeMockCtx();
		const data = (await speedtestFetcher()(ctx, {
			type: "speedtest",
		})) as SpeedtestData;

		expect(data.lastResult).not.toBeNull();
		expect(data.lastResult?.download).toBe(850.5);
		expect(data.lastResult?.upload).toBe(620.2);
		expect(data.lastResult?.ping).toBe(7.2);
		expect(data.lastResult?.client?.isp).toBe("StarHub");
	});
});
