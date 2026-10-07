import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

// ── per-widget defaults (file header owns DEFAULTS + Schema + PREF) ──
export const TAILSCALE_DEFAULTS = {
	/** `-` is Tailscale's own shorthand for "whichever tailnet owns this key"
	 *  (tailscale.com/kb/1215/oauth-clients#shorthand-notation-for-tailnet-id). */
	tailnet: "-",
	limit: 20,
} as const;
export const TAILSCALE_PREF: Pref = {
	cols: 3,
	rows: 2,
	resizable: true,
	priority: 5,
	zone: "main",
	preferredWidth: 340,
	preferredHeight: 220,
};
/** One status dot beside a name and a detail line — two lines per device. */
export const TAILSCALE_SKELETON: SkeletonShape = "list";

// No credential field: the config is served to the browser verbatim, so a key
// in the YAML is a key in the page. TS_API_KEY is the only source.
export const tailscaleSchema = z.object({
	type: z.literal("tailscale"),
	...sharedWidgetFields,
	/** Tailnet id or `-` for the tailnet owning the key. */
	tailnet: z.string().default(TAILSCALE_DEFAULTS.tailnet),
	/** Online devices are listed first, so this is the visible head count. */
	limit: z.number().int().min(1).max(200).default(TAILSCALE_DEFAULTS.limit),
});

export type TailscaleConfig = z.infer<typeof tailscaleSchema>;
