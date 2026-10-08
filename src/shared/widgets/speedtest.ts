import { z } from "zod";
import { type Pref, type SkeletonShape, sharedWidgetFields } from "./shared";

export const SPEEDTEST_DEFAULTS = {
	units: "Mbps",
} as const;

export const SPEEDTEST_PREF: Pref = {
	cols: 4,
	rows: 3,
	resizable: false,
	priority: 6,
	zone: "main",
	preferredWidth: 380,
	preferredHeight: 320,
};

export const SPEEDTEST_SKELETON: SkeletonShape = "stat";

export const speedtestSchema = z.object({
	type: z.literal("speedtest"),
	...sharedWidgetFields,
	"server-id": z.string().optional(),
	units: z.enum(["Mbps", "MB/s"]).default(SPEEDTEST_DEFAULTS.units),
});

export type SpeedtestConfig = z.infer<typeof speedtestSchema>;
