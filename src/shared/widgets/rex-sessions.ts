import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const REX_SESSIONS_DEFAULTS = { limit: 12 } as const;
export const REX_SESSIONS_PREF: Pref = {
	cols: 4,
	rows: 3,
	resizable: true,
	priority: 6,
	zone: "main",
	preferredWidth: 380,
	preferredHeight: 300,
};
/** Status dot + title/process line + breadcrumb/age line per terminal block. */
export const REX_SESSIONS_SKELETON: SkeletonShape = "list";

export const rexSessionsSchema = z
	.object({
		type: z.literal("rex-sessions"),
		...sharedWidgetFields,
		/** Max terminal blocks to return; sessions/windows are never cut, only the flat block list. */
		limit: z.number().int().min(1).max(200).default(REX_SESSIONS_DEFAULTS.limit),
	})
	.loose();

export type RexSessionsConfig = z.infer<typeof rexSessionsSchema>;
