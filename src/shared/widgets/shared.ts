import { z } from "zod";

/** Defaults for the shared fields. `retries` reproduces the fetcher's
 * pre-config behaviour, so an unconfigured dashboard retries exactly as it
 * did before and nothing changes until a widget sets it. */
export const SHARED_WIDGET_DEFAULTS = {
	retries: 3,
	"show-errors": true,
} as const;

/** Ceiling on `retries` — the default is 3, and a bigger budget only delays
 * the poll cycle without meaningfully improving the odds. */
export const MAX_WIDGET_RETRIES = 10;

/** Props every widget accepts (glance "Shared Properties" table). Leaf module
 * so widget schemas and the registry can both import it without cycles. */
export const sharedWidgetFields = {
	title: z.string().optional(),
	"title-url": z.string().optional(),
	"hide-header": z.boolean().optional(),
	cache: z.string().optional(),
	"css-class": z.string().optional(),
	/** Extra fetch attempts after the first one; 0 means "try once, never
	 * retry". Parsed in server/widgets/http.ts and handed to fetchWithRetry. */
	retries: z
		.number()
		.int()
		.min(0)
		.max(MAX_WIDGET_RETRIES)
		.default(() => SHARED_WIDGET_DEFAULTS.retries),
	/** false renders a failed widget quietly — no error Banner, just the chrome
	 * and whatever content it still has. The StatusDot beside the title keeps
	 * reporting the failure, so quiet never means invisible. Defaults true: a
	 * self-hosted dashboard must not fail silently. */
	"show-errors": z.boolean().default(() => SHARED_WIDGET_DEFAULTS["show-errors"]),
	// pure-compositor hints — ignored in columns mode, used when `widgets` is flat
	priority: z.number().int().min(0).max(10).optional(),
	span: z.number().int().min(1).max(12).optional(),
	zone: z.enum(["main", "sidebar"]).optional(),
};

/** Widget-local bento default, co-located with each widget's schema and
 * aggregated by preferredSizes.ts. Units are pure-bento grid units:
 * `cols` counts tracks of the underlying 12-col grid (null = fluid width),
 * `rows` counts `grid-row-height` units. `preferredWidth/Height` are the
 * legacy px hints still read by the collage chooser. */
export type Pref = {
	cols: number | null;
	rows: number;
	resizable: boolean;
	priority: number;
	zone: "main" | "sidebar";
	preferredWidth: number | null;
	preferredHeight: number | null;
};

/** Loading silhouette per widget (WidgetChrome skeleton). Co-located with
 * each schema as `<NAME>_SKELETON`; aggregated by the registry in index.ts. */
export type SkeletonShape = "list" | "stat" | "chart" | "rows";
