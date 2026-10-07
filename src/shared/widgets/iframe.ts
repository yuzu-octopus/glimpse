import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const IFRAME_PREF: Pref = {
	cols: 6,
	rows: 3,
	resizable: false,
	priority: 4,
	zone: "main",
	preferredWidth: 500,
	preferredHeight: 400,
};
/** A full-bleed frame in a 500x400 tile. Three hairlines promise text; a
 * solid block is the only one of the four that does not. */
export const IFRAME_SKELETON: SkeletonShape = "chart";

export const iframeSchema = z.object({
	type: z.literal("iframe"),
	...sharedWidgetFields,
	source: z.string(),
	height: z.number().int().min(50).optional(),
});
export type IframeConfig = z.infer<typeof iframeSchema>;

export const htmlSchema = z.object({
	type: z.literal("html"),
	...sharedWidgetFields,
	source: z.string(),
});
export type HtmlConfig = z.infer<typeof htmlSchema>;

export const HTML_PREF: Pref = {
	cols: null,
	rows: 2,
	resizable: true,
	priority: 4,
	zone: "main",
	preferredWidth: null,
	preferredHeight: 200,
};

/** Arbitrary user markup — as likely a couple of lines as a filled block, so
 * the neutral text placeholder stays (unlike its full-bleed sibling above). */
export const HTML_SKELETON: SkeletonShape = "rows";
