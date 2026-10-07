import { describe, expect, it } from "vitest";
import { type WidgetType, widgetMeta } from "./index";
import { SKELETON_SHAPE } from "./preferredSizes";
import type { SkeletonShape } from "./shared";

/**
 * The loading silhouette each widget's body actually has, pinned per type.
 *
 * `SKELETON_SHAPE` is derived from `widgetMeta`, so it cannot drift away from
 * the registry — but it can drift away from the *renderer*, silently, and
 * nothing else in the tree notices. A skeleton whose kind does not match what
 * replaces it reads as a broken widget rather than a loading one, and one that
 * is far shorter than the content makes the card jump when data lands. Hence a
 * literal expectation for all 42 types rather than a spot check: a new widget
 * type fails to compile here until its shape is pinned, and an edit to any
 * `*_SKELETON` constant fails here until the pin is updated with it.
 *
 * The four shapes, and what earns each (from `ChromeSkeleton` in WidgetChrome):
 *
 *   list   5 rows of [24px glyph, 12px line, 10px line]  — ~180px. A vertical
 *          list of items that each lead with a glyph and carry one or two
 *          lines beside it: feeds, entity lists, thumbnail rows.
 *   stat   one 48px block + a 40%-width caption          —  ~70px. A body
 *          dominated by one or a few large values with short labels.
 *   chart  one 100% x 120px block                       — ~120px. A body that is
 *          a filled area: a card grid, a graph, a cell/date grid, a map, a
 *          dial. Also the honest fallback for any block that is not text.
 *   rows   3 x 14px lines                               —   ~58px. A short stack
 *          of single text lines: a table, a form, one field, an editor.
 *
 * Where a body fits none of the four exactly, the nearest is used and the
 * compromise is named — a fifth shape is a `WidgetChrome` change, not a
 * registry one.
 */
const EXPECTED: Record<WidgetType, SkeletonShape> = {
	// ── config-driven renderers: no chunk ever arrives, so these show in the
	// page-level skeleton only. Still worth the right silhouette.
	notepad: "rows", // a textarea: three text lines is the shape of the thing
	timer: "chart", // a filled dial in a 300px tile; a real `dial` is out of scope
	bookmarks: "list", // icon tile + title + optional description
	search: "rows", // one search field
	clock: "stat", // the big time, then the date
	calendar: "chart", // a 7x6 day grid — no shape says "grid", a block is closest
	todo: "rows", // a form row plus single-line checkbox items
	iframe: "chart", // a full-bleed frame in a 500x400 tile
	html: "rows", // arbitrary user markup; text is as likely as a block
	group: "rows", // a tab strip over one child card
	"split-column": "rows", // a grid of child cards

	// ── feeds: thumb + title + description, so `list`
	rss: "list",
	"hacker-news": "list",
	reddit: "list",
	lobsters: "list",
	releases: "list",
	"change-detection": "list",
	"github-trending": "list",
	"events-calendar": "list", // day groups of two-line events
	"twitch-channels": "list", // avatar + name/title/meta
	"twitch-top-games": "list", // rank + box art + name

	// ── media card grids: a filled area
	videos: "chart",
	immich: "chart",
	jellyfin: "chart",

	// ── headline values
	weather: "stat", // the big temperature leads; six day-lines follow
	network: "stat", // three label/value cells over a bar sparkline
	"ai-quota": "stat", // a bar and a caption per window

	// ── single-line row lists: icon/dot-free, one line per item
	markets: "rows", // symbol, name, sparkline, change, price
	monitor: "rows", // one line per site
	repository: "rows", // a repo header plus single-line sub-list rows
	"system-stats": "rows", // one labelled row per reading
	"server-stats": "rows", // one labelled icon row per metric
	"model-endpoints": "rows", // a compact table of thin rows

	// ── glyph + two lines per item
	"custom-api": "list", // optional thumbnail, title, description
	"docker-containers": "list", // 28px icon, name, image/description
	"home-assistant": "list", // status dot, name, entity id
	tailscale: "list", // status dot, name, os/version or "seen Nh ago"
	qbittorrent: "list", // name, progress bar, stats line
	transmission: "list", // same body as qbittorrent

	// ── grids, graphs and full-bleed blocks
	"dns-stats": "chart", // three value blocks over a bar graph
	"contribution-graph": "chart", // a 52x7 cell grid
	"weather-radar": "chart", // a 2x2 map tile grid
};

describe("SKELETON_SHAPE", () => {
	it("matches what each renderer actually draws", () => {
		// toEqual, not a per-key expect: one drifted constant should report the
		// whole diff, not the first mismatch.
		expect(SKELETON_SHAPE).toEqual(EXPECTED);
	});

	it("pins every registered type exactly once", () => {
		// `Record<WidgetType, …>` above already fails to compile on a missing
		// type; this catches the other direction — a type registered but never
		// pinned would compile only if the union and the object had drifted apart.
		expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(widgetMeta).sort());
	});

	it("never falls outside the four shapes WidgetChrome can draw", () => {
		for (const [type, shape] of Object.entries(SKELETON_SHAPE)) {
			expect(["list", "stat", "chart", "rows"], `${type} -> ${shape}`).toContain(shape);
		}
	});
});
