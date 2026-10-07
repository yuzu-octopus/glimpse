import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function run(file: string): { code: number; out: string } {
	try {
		const out = execFileSync("bun", ["scripts/check-config.ts", file], { encoding: "utf8" });
		return { code: 0, out };
	} catch (e) {
		const err = e as { status?: number; stdout?: string };
		return { code: err.status ?? 1, out: String(err.stdout ?? e) };
	}
}

function fixture(body: string): string {
	const dir = mkdtempSync(join(tmpdir(), "check-config-"));
	const file = join(dir, "config.yml");
	writeFileSync(file, body);
	return file;
}

describe("check-config did-you-mean scope", () => {
	it("ignores non-widget `type:` keys (server-stats servers)", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: server-stats\n            servers:\n              - type: local\n                name: Glimpse\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).not.toContain("unknown widget type");
	});

	it("still suggests for a typo'd widget type", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: rsss\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(1);
		expect(out).toContain('unknown widget type "rsss" — did you mean "rss"?');
	});
});

describe("check-config unsupported options", () => {
	it("warns about a glance option Glimpse does not implement, with its path", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: weather\n            location: Berlin\n            show-area-name: true\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).toContain(
			'warning: line 8: "show-area-name" is not a supported option of the weather widget (pages[0].columns[0].widgets[0].show-area-name) — Glimpse ignores it',
		);
	});

	it("stays quiet for an option that IS implemented", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: rss\n            feeds:\n              - url: https://x/f\n                item-link-prefix: https://x/\n          - type: repository\n            repository: a/b\n            commits-limit: 3\n          - type: bookmarks\n            groups:\n              - title: D\n                hide-arrow: true\n                links:\n                  - title: G\n                    url: https://g\n                    target: _self\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).not.toContain("not a supported option");
	});

	it("leaves top-level glance keys alone — they are not stripped, just unused", () => {
		const file = fixture(
			"app-name: Mine\nport: 8080\nlogo-url: /l.png\npages:\n  - name: T\n    widgets:\n      - type: clock\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).not.toContain("not a supported option");
	});

	it("does not read a block scalar body as config", () => {
		const file = fixture(
			"pages:\n  - name: T\n    widgets:\n      - type: notepad\n        id: n\n        content: |\n          - type: rss\n            made-up: 1\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).not.toContain("made-up");
		// `content` itself is not a notepad option, so that one is real
		expect(out).toContain('"content" is not a supported option');
	});
});

describe("check-config removed credentials", () => {
	it("names the env var a removed credential moved to", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: immich\n            url: https://immich.lab\n            api-key: hunter2\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).toContain('"api-key" is no longer read from the config of the immich widget');
		expect(out).toContain("set IMMICH_API_KEY in the environment instead");
	});

	it("stays quiet when the credential was never in the file", () => {
		const file = fixture(
			"pages:\n  - name: T\n    columns:\n      - span: 12\n        widgets:\n          - type: immich\n            url: https://immich.lab\n            limit: 5\n",
		);
		const { code, out } = run(file);
		expect(code).toBe(0);
		expect(out).not.toContain("no longer read from the config");
	});
});
