import type { SpeedtestData } from "../../shared/widgets/payloads";
import { speedtestSchema } from "../../shared/widgets/speedtest";
import { getLastSpeedtestResult } from "../speedtest";
import { registerWidget } from "./registry";

registerWidget("speedtest", async (_ctx, config): Promise<SpeedtestData> => {
	speedtestSchema.parse(config);
	return {
		lastResult: getLastSpeedtestResult(),
	};
});
