import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

export const CONTRIBUTION_GRAPH_DEFAULTS = { limit: 52 } as const;
export const CONTRIBUTION_GRAPH_PREF: Pref = {
	cols: 6,
	rows: 2,
	resizable: false,
	priority: 5,
	zone: "main",
	preferredWidth: 480,
	preferredHeight: 160,
};

/** A summary line over a 52x7 cell grid — a block of texture, not text. */
export const CONTRIBUTION_GRAPH_SKELETON: SkeletonShape = "chart";

// No `token` here: it was never sent to github.com (the fetcher scrapes public
// profile HTML), so it only existed to put a secret in the config — which the
// server hands to the browser verbatim.
export const contributionGraphSchema = z.object({
	type: z.literal("contribution-graph"),
	...sharedWidgetFields,
	username: z.string().min(1),
	limit: z.number().int().min(1).max(104).default(CONTRIBUTION_GRAPH_DEFAULTS.limit),
});
export type ContributionGraphConfig = z.infer<typeof contributionGraphSchema>;
