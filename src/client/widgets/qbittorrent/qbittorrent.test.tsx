import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TorrentData } from "../../../shared/widgets/payloads";
import Qbittorrent from "./index";

const data: TorrentData = {
	torrents: [
		{
			name: "ubuntu.iso",
			progress: 0.42,
			state: "downloading",
			size: 4_000_000_000,
			downloadSpeed: 12_000_000,
			uploadSpeed: 0,
			eta: 300,
		},
		{
			name: "done.mkv",
			progress: 1,
			state: "uploading",
			size: 800_000_000,
			downloadSpeed: 0,
			uploadSpeed: 500_000,
			eta: null,
		},
	],
};

describe("qbittorrent widget", () => {
	it("renders torrent rows with progress bars and states", () => {
		render(<Qbittorrent config={{ type: "qbittorrent" }} data={data} />);
		expect(screen.getByText("qBittorrent")).toBeInTheDocument();
		expect(screen.getByText("ubuntu.iso")).toBeInTheDocument();
		expect(screen.getByTestId("torrent-state-downloading")).toBeInTheDocument();
		expect(screen.getByRole("progressbar", { name: /ubuntu/ })).toHaveAttribute(
			"aria-valuenow",
			"42",
		);
		expect(screen.getByText("42%")).toBeInTheDocument();
		expect(screen.getByText("100%")).toBeInTheDocument();
	});

	it("shows both rates, each with its direction", () => {
		const { container } = render(<Qbittorrent config={{ type: "qbittorrent" }} data={data} />);
		// The seeder's rate was fetched and thrown away; two bare speeds with no
		// direction read as one, so each carries its arrow.
		expect(screen.getByText("11.4 MB/s")).toBeInTheDocument();
		expect(screen.getByText("488 KB/s")).toBeInTheDocument();
		expect(container.querySelectorAll("svg.lucide-arrow-down")).toHaveLength(2);
		expect(container.querySelectorAll("svg.lucide-arrow-up")).toHaveLength(2);
	});

	it("omits a rate the client never reported", () => {
		const { container } = render(
			<Qbittorrent
				config={{ type: "qbittorrent" }}
				data={{ torrents: [{ ...data.torrents[0]!, downloadSpeed: null, uploadSpeed: null }] }}
			/>,
		);
		expect(container.querySelector("svg.lucide-arrow-down")).toBeNull();
		expect(container.querySelector("svg.lucide-arrow-up")).toBeNull();
		// the parts we do have are still there
		expect(screen.getByText("3.7 GB")).toBeInTheDocument();
		expect(screen.getByText("5m left")).toBeInTheDocument();
	});

	it("shows a placeholder when empty", () => {
		render(<Qbittorrent config={{ type: "qbittorrent" }} data={{ torrents: [] }} />);
		expect(screen.getByText(/No torrents/)).toBeInTheDocument();
	});

	it("shows loading skeleton while data is null", () => {
		render(<Qbittorrent config={{ type: "qbittorrent" }} data={null} />);
		expect(screen.getByTestId("widget-loading")).toBeInTheDocument();
	});

	it("surfaces fetch errors via chrome", () => {
		render(
			<Qbittorrent
				config={{ type: "qbittorrent" }}
				data={null}
				error="qbittorrent: login failed"
			/>,
		);
		expect(screen.getByText("qbittorrent: login failed")).toBeInTheDocument();
		expect(screen.getByTestId("widget-error-dot")).toBeInTheDocument();
	});
});
