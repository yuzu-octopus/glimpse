import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureWidgetLoaded, scheduleWidgetPreload, widgetLoaders } from "./index";

// A widget chunk is a network fetch like any other: a stale service-worker
// chunk name after a deploy, or a storage-pressure eviction, makes the import
// reject once. The memo used to keep that resolved-undefined promise for the
// rest of the session, so the widget sat on its Suspense skeleton until the
// tab closed — even after the network came back. The memo is module state with
// no reset seam, so each case drives its own type name: the cold path.
// The counter is module-level because the afterEach below drains the cleanup
// list, not the sequence.
let sequence = 0;
const types: string[] = [];
const freshType = (): string => {
	const type = `test-chunk-${sequence++}`;
	types.push(type);
	return type;
};

describe("ensureWidgetLoaded", () => {
	afterEach(() => {
		for (const t of types.splice(0)) delete widgetLoaders[t];
	});

	it("dedupes concurrent callers onto one import", () => {
		const type = freshType();
		const loader = vi.fn(() => new Promise<unknown>(() => {}));
		widgetLoaders[type] = loader;

		expect(ensureWidgetLoaded(type)).toBe(ensureWidgetLoaded(type));
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("re-attempts after a chunk that failed to load", async () => {
		const type = freshType();
		const loader = vi
			.fn<() => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("Failed to fetch dynamically imported module"))
			.mockResolvedValue({ loaded: true });
		widgetLoaders[type] = loader;

		await expect(ensureWidgetLoaded(type)).resolves.toBeUndefined();
		// Let the rejection path settle before the next caller asks.
		await Promise.resolve();

		await expect(ensureWidgetLoaded(type)).resolves.toEqual({ loaded: true });
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("drops the iframe/html alias alongside the entry that failed", async () => {
		const loader = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error("chunk 404"));
		const realHtml = widgetLoaders["html"];
		const realIframe = widgetLoaders["iframe"];
		widgetLoaders["html"] = loader;
		widgetLoaders["iframe"] = loader;
		try {
			// iframe and html share one import, so loading html warms the iframe
			// alias against the same promise.
			await ensureWidgetLoaded("html");
			await Promise.resolve();

			await ensureWidgetLoaded("html");
			expect(loader).toHaveBeenCalledTimes(2);
			await ensureWidgetLoaded("iframe");
			expect(loader).toHaveBeenCalledTimes(3);
		} finally {
			widgetLoaders["html"] = realHtml;
			widgetLoaders["iframe"] = realIframe;
		}
	});

	it("returns null for containers and unknown types", () => {
		expect(ensureWidgetLoaded("group")).toBeNull();
		expect(ensureWidgetLoaded("split-column")).toBeNull();
		expect(ensureWidgetLoaded("no-such-widget")).toBeNull();
	});
});

describe("scheduleWidgetPreload", () => {
	it("warms each visible-page chunk once, on idle", () => {
		const type = "test-preload-chunk";
		const loader = vi.fn(() => Promise.resolve({}));
		widgetLoaders[type] = loader;
		const idle: Array<() => void> = [];
		const g = globalThis as unknown as { requestIdleCallback?: (cb: () => void) => number };
		const realIdle = g.requestIdleCallback;
		g.requestIdleCallback = (cb) => {
			idle.push(cb);
			return 0;
		};
		try {
			scheduleWidgetPreload([type, type, "no-such-widget"]);
			expect(loader).not.toHaveBeenCalled();
			for (const cb of idle) cb();
			expect(loader).toHaveBeenCalledTimes(1);
		} finally {
			g.requestIdleCallback = realIdle;
			delete widgetLoaders[type];
		}
	});

	it("is a no-op with nothing to preload", () => {
		expect(() => scheduleWidgetPreload([])).not.toThrow();
		expect(() => scheduleWidgetPreload()).not.toThrow();
	});
});
