import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Speedtest from "./index";

const SAMPLE_RESULT = {
	download: 754.2,
	upload: 624.3,
	ping: 6.7,
	client: { isp: "StarHub", ip: "39.109.255.32" },
	server: { name: "Singapore", sponsor: "fdcservers.net", country: "Singapore" },
	timestamp: "2026-10-08T10:00:00Z",
};

describe("Speedtest component", () => {
	it("renders idle state with GO button when no prior results exist", () => {
		render(<Speedtest config={{ type: "speedtest" }} data={{ lastResult: null }} />);

		expect(screen.getByRole("button", { name: "Start speed test" })).toBeInTheDocument();
		expect(screen.getByText("GO")).toBeInTheDocument();
	});

	it("renders speedometer and metrics when prior results exist", () => {
		render(<Speedtest config={{ type: "speedtest" }} data={{ lastResult: SAMPLE_RESULT }} />);

		expect(screen.getByText("754.2 Mbps")).toBeInTheDocument();
		expect(screen.getByText("624.3 Mbps")).toBeInTheDocument();
		expect(screen.getByText("6.7 ms")).toBeInTheDocument();

		expect(screen.getByText("StarHub")).toBeInTheDocument();
		expect(screen.getByText("39.109.255.32")).toBeInTheDocument();
		expect(screen.getByText("fdcservers.net")).toBeInTheDocument();

		expect(screen.getByRole("button", { name: "Test Again" })).toBeInTheDocument();
	});

	it("renders network and dashed-out server in blank state", () => {
		render(
			<Speedtest
				config={{ type: "speedtest" }}
				data={{ lastResult: null, client: { isp: "StarHub", ip: "39.109.255.32" } }}
			/>,
		);

		expect(screen.getByText("StarHub")).toBeInTheDocument();
		expect(screen.getByText("39.109.255.32")).toBeInTheDocument();
		expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
	});
});
