import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getConfig, initConfig, loadConfig } from "./config";

const feedUrlSchema = z.object({ feeds: z.array(z.object({ url: z.string() })) });
function firstFeedUrl(widget: unknown): string {
	return feedUrlSchema.parse(widget).feeds[0].url;
}

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "glimpse-config-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	for (const k of ["GLIMPSE_DX_UNSET", "GLIMPSE_DX_SET", "GLIMPSE_DX_EMPTY"]) delete process.env[k];
});

function write(name: string, content: string): string {
	const p = join(dir, name);
	writeFileSync(p, content);
	return p;
}

const VALID = `
pages:
  - name: Home
    columns:
      - size: small
        widgets:
          - type: clock
      - size: full
        widgets:
          - type: rss
            feeds:
              - url: https://example.com/feed.xml
`;

describe("loadConfig", () => {
	it("loads a valid config and derives slugs", () => {
		const r = loadConfig(write("glance.yml", VALID));
		expect(r.ok).toBe(true);
		expect(r.config?.pages[0].slug).toBe("home");
	});

	it("loads a flat bento page without columns", () => {
		const r = loadConfig(
			write(
				"glance.yml",
				`
pages:
  - name: Home
    grid-columns: 12
    grid-row-height: 96
    widgets:
      - type: clock
      - type: rss
        feeds:
          - url: https://example.com/feed.xml
`,
			),
		);
		expect(r.ok).toBe(true);
		expect(r.config?.pages[0].widgets).toHaveLength(2);
		expect(r.config?.pages[0]["grid-columns"]).toBe(12);
		expect(r.config?.pages[0]["grid-row-height"]).toBe(96);
	});

	it("uses an explicit slug verbatim", () => {
		const r = loadConfig(
			write("glance.yml", VALID.replace("- name: Home", "- name: Home\n    slug: start")),
		);
		expect(r.ok).toBe(true);
		expect(r.config?.pages[0].slug).toBe("start");
	});

	it("slugifies names with spaces and punctuation", () => {
		const r = loadConfig(
			write("glance.yml", VALID.replace("- name: Home", '- name: "My Home Page!"')),
		);
		expect(r.config?.pages[0].slug).toBe("my-home-page");
	});

	it("reports duplicate slugs", () => {
		const twoPages = `
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
  - name: "home"
    columns:
      - size: full
        widgets: [{ type: clock }]
`;
		const r = loadConfig(write("glance.yml", twoPages));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("duplicate page slug"))).toBe(true);
	});

	it("rejects invalid YAML", () => {
		const r = loadConfig(write("glance.yml", "pages: [unclosed"));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("invalid YAML"))).toBe(true);
	});

	it("reports a missing config file", () => {
		const r = loadConfig(join(dir, "nope.yml"));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("cannot read"))).toBe(true);
	});

	it("requires at least one full column", () => {
		const bad = `
pages:
  - name: Home
    columns:
      - size: small
        widgets: [{ type: clock }]
`;
		const r = loadConfig(write("glance.yml", bad));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("at least one full column"))).toBe(true);
	});

	it("rejects more than two full columns", () => {
		const bad = `
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
      - size: full
        widgets: [{ type: clock }]
      - size: full
        widgets: [{ type: clock }]
`;
		const r = loadConfig(write("glance.yml", bad));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("more than two full columns"))).toBe(true);
	});

	it("rejects a group widget nested inside a group", () => {
		const bad = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: group
            widgets:
              - type: group
                widgets: [{ type: clock }]
`;
		const r = loadConfig(write("glance.yml", bad));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("cannot contain"))).toBe(true);
	});

	it("interpolates env vars from the environment", () => {
		process.env.GLIMPSE_TEST_TOKEN = "sekrit";
		const r = loadConfig(
			write(
				"glance.yml",
				VALID.replace(
					"https://example.com/feed.xml",
					"https://example.com/${GLIMPSE_TEST_TOKEN}/feed.xml",
				),
			),
		);
		expect(r.ok).toBe(true);
		expect(firstFeedUrl(r.config!.pages[0].columns![1].widgets[0])).toBe(
			"https://example.com/sekrit/feed.xml",
		);
	});

	it("errors when an env var is missing", () => {
		const r = loadConfig(
			write(
				"glance.yml",
				VALID.replace(
					"https://example.com/feed.xml",
					"https://example.com/${GLIMPSE_MISSING_VAR}/feed.xml",
				),
			),
		);
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("GLIMPSE_MISSING_VAR"))).toBe(true);
	});

	it("does not touch ${secret:...} Docker syntax", () => {
		const r = loadConfig(
			write(
				"glance.yml",
				VALID.replace(
					"https://example.com/feed.xml",
					"https://example.com/${secret:github_token}/feed.xml",
				),
			),
		);
		expect(r.ok).toBe(true);
		expect(firstFeedUrl(r.config!.pages[0].columns![1].widgets[0])).toBe(
			"https://example.com/${secret:github_token}/feed.xml",
		);
	});

	it("merges included files (pages appended, custom-css-file overridden)", () => {
		write(
			"extra.yml",
			`
pages:
  - name: Extra
    columns:
      - size: full
        widgets: [{ type: clock }]
'custom-css-file': extra.css
`,
		);
		const main = write(
			"glance.yml",
			`
$include: extra.yml
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
'custom-css-file': main.css
`,
		);
		const r = loadConfig(main);
		expect(r.ok).toBe(true);
		expect(r.config?.pages.map((p) => p.name)).toEqual(["Home", "Extra"]);
		expect(r.config?.["custom-css-file"]).toBe("extra.css");
	});

	it("fails a config that still carries a theme block, naming the fix", () => {
		const main = write(
			"glance.yml",
			`
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
theme:
  'primary-color': 200 50 50
`,
		);
		const r = loadConfig(main);
		expect(r.ok).toBe(false);
		expect(r.errors).toEqual([
			"config.theme: block removed — Glimpse now uses the astryx-dracula theme; delete the theme block from your config (if you set a custom stylesheet, move it to a top-level `custom-css-file:` key)",
		]);
	});

	it("detects circular includes", () => {
		write(
			"a.yml",
			"$include: b.yml\npages:\n  - name: A\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n",
		);
		write(
			"b.yml",
			"$include: a.yml\npages:\n  - name: B\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n",
		);
		const r = loadConfig(join(dir, "a.yml"));
		expect(r.ok).toBe(false);
		expect(r.errors?.some((e) => e.includes("circular"))).toBe(true);
	});

	it("returns files for main + every include after a diamond include", () => {
		write(
			"common.yml",
			"pages:\n  - name: Common\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n",
		);
		write("left.yml", "$include: common.yml\n");
		write("right.yml", "$include: common.yml\n");
		const main = write(
			"glance.yml",
			`
$include:
  - left.yml
  - right.yml
pages:
  - name: Home
    columns:
      - size: full
        widgets: [{ type: clock }]
`,
		);
		const r = loadConfig(main);
		expect(r.ok).toBe(true);
		for (const name of ["glance.yml", "left.yml", "right.yml", "common.yml"]) {
			expect(r.files).toContain(join(dir, name));
		}
	});
});

describe("config dx", () => {
	const page = (url: string): string => `pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: rss
            feeds:
              - url: ${url}
`;

	it("uses the ${VAR:-fallback} default when the var is missing", () => {
		const r = loadConfig(write("c.yml", page("https://example.com/${GLIMPSE_DX_UNSET:-fb}/x.xml")));
		expect(r.ok).toBe(true);
		expect(JSON.stringify(r.config)).toContain("https://example.com/fb/x.xml");
	});

	it("prefers a set var over the fallback", () => {
		process.env.GLIMPSE_DX_SET = "real";
		const r = loadConfig(write("c.yml", page("https://example.com/${GLIMPSE_DX_SET:-fb}/x.xml")));
		expect(r.ok).toBe(true);
		expect(JSON.stringify(r.config)).toContain("https://example.com/real/x.xml");
	});

	it("supports the ${VAR-fallback} form and empty fallbacks", () => {
		const r = loadConfig(write("c.yml", page("https://example.com/${GLIMPSE_DX_UNSET-fb}/x.xml")));
		expect(r.ok).toBe(true);
		expect(JSON.stringify(r.config)).toContain("https://example.com/fb/x.xml");
		process.env.GLIMPSE_DX_EMPTY = "";
		const r2 = loadConfig(
			write("c2.yml", page("https://example.com/${GLIMPSE_DX_EMPTY:-fb}/x.xml")),
		);
		expect(r2.ok).toBe(true);
		expect(JSON.stringify(r2.config)).toContain("https://example.com/fb/x.xml");
	});

	it("leaves ${secret:...} untouched even with a fallback suffix", () => {
		// The loadConfig block already covers the bare `${secret:tok}` form. This
		// retarget is the case that one does not reach: a default after the colon,
		// where a naive regex that stopped at the first `}` would substitute.
		const r = loadConfig(write("c.yml", page("https://example.com/${secret:tok:-fb}/x.xml")));
		expect(r.ok).toBe(true);
		expect(JSON.stringify(r.config)).toContain("${secret:tok:-fb}");
	});

	it("warns instead of dropping unsupported $include keys", () => {
		write(
			"extra.yml",
			"server: { port: 1234 }\npages:\n  - name: Extra\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n",
		);
		const main = write(
			"main.yml",
			"$include: extra.yml\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n",
		);
		const r = loadConfig(main);
		expect(r.ok).toBe(true);
		expect(r.config?.pages.map((p) => p.name)).toEqual(["Home", "Extra"]);
		expect(r.warnings?.some((w) => w.includes('"server"'))).toBe(true);
	});
});

describe("initConfig auto-reload", () => {
	const page = (name: string): string =>
		`pages:\n  - name: ${name}\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n`;
	/** Indentation error — loadYamlTree records the file, errors out, returns null. */
	const broken = (): string => "pages:\n  - name: Home\n   columns: [\n";

	/** main.yml pulling in a → b → c. */
	function chain(): { main: string; mainYaml: string; includes: string[] } {
		const includes = ["a.yml", "b.yml", "c.yml"].map((n) => write(n, page(n[0].toUpperCase())));
		const mainYaml =
			"$include:\n  - a.yml\n  - b.yml\n  - c.yml\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: [{ type: clock }]\n";
		return { main: write("main.yml", mainYaml), mainYaml, includes };
	}

	it("a failed reload keeps watching the includes its file list lost", async () => {
		const { main, mainYaml, includes } = chain();
		const reloads: boolean[] = [];
		expect(initConfig(main, (r) => reloads.push(r.ok)).ok).toBe(true);

		// One file write emits several fs events, and the reload debounce is only
		// 150ms, so a straggler event would look exactly like the watcher under
		// test. Every step therefore starts from silence: sample the reload count
		// until it holds steady for longer than the debounce.
		const idle = async (): Promise<void> => {
			let last = reloads.length;
			for (let i = 0; i < 40; i++) {
				await new Promise((r) => setTimeout(r, 200));
				if (reloads.length === last) return;
				last = reloads.length;
			}
		};
		/** Edit one file and assert it alone provoked a reload with `ok`. */
		const editAlone = async (edit: () => void, ok: boolean): Promise<void> => {
			await idle();
			const before = reloads.length;
			edit();
			await vi.waitFor(() => expect(reloads.length).toBeGreaterThan(before), {
				interval: 100,
				timeout: 3000,
			});
			expect(reloads.at(-1)).toBe(ok);
		};

		await editAlone(() => writeFileSync(main, broken()), false);
		expect(getConfig().ok).toBe(true); // last-good config kept…

		// a.yml is an include: the failed load's file list no longer mentions it
		await editAlone(() => writeFileSync(includes[0]!, page("A2")), false);

		await editAlone(() => writeFileSync(main, mainYaml), true);
		expect(getConfig().config?.pages.map((p) => p.name)).toEqual(["Home", "A2", "B", "C"]);
	}, 30_000);
});
