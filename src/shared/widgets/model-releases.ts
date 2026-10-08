import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

export const MODEL_RELEASES_DEFAULTS = {
	limit: 10,
	style: "vertical-list",
} as const;

export const MODEL_RELEASES_PREF: Pref = {
	cols: 4,
	rows: 3,
	resizable: true,
	priority: 8,
	zone: "main",
	preferredWidth: 380,
	preferredHeight: 300,
};

export const MODEL_RELEASES_SKELETON: SkeletonShape = "list";

export const modelReleasesSchema = z.object({
	type: z.literal("model-releases"),
	...sharedWidgetFields,
	limit: z.number().int().min(1).max(50).default(MODEL_RELEASES_DEFAULTS.limit),
	style: z.enum(["vertical-list", "compact"]).default(MODEL_RELEASES_DEFAULTS.style),
	labs: z.array(z.string()).optional(),
	"collapse-after": z.number().int().min(-1).optional(),
});

export type ModelReleasesConfig = z.infer<typeof modelReleasesSchema>;
