import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Notepad } from "./index";

beforeEach(() => localStorage.clear());

describe("notepad widget", () => {
	it("renders and persists text to localStorage", () => {
		render(
			<Notepad
				config={{ type: "notepad", id: "a" } as unknown as Record<string, unknown>}
				data={null}
			/>,
		);
		const area = screen.getByTestId("notepad-area") as HTMLTextAreaElement;
		fireEvent.change(area, { target: { value: "hello" } });
		expect(area.value).toBe("hello");
		expect(localStorage.getItem("glimpse.notepad.a")).toBe("hello");
	});

	it("restores persisted text on mount", () => {
		localStorage.setItem("glimpse.notepad.b", "saved");
		render(
			<Notepad
				config={{ type: "notepad", id: "b" } as unknown as Record<string, unknown>}
				data={null}
			/>,
		);
		expect((screen.getByTestId("notepad-area") as HTMLTextAreaElement).value).toBe("saved");
	});

	it("renders the configured placeholder text", () => {
		render(
			<Notepad
				config={
					{ type: "notepad", id: "ph", placeholder: "Write something…" } as unknown as Record<
						string,
						unknown
					>
				}
				data={null}
			/>,
		);
		expect(screen.getByPlaceholderText("Write something…")).toBeInTheDocument();
	});

	it("renders the title in the header", () => {
		render(
			<Notepad
				config={
					{ type: "notepad", id: "t", title: "My Notes" } as unknown as Record<string, unknown>
				}
				data={null}
			/>,
		);
		expect(screen.getByText("My Notes")).toBeInTheDocument();
	});

	it("sets aria-label on the textarea from the title", () => {
		render(
			<Notepad
				config={
					{ type: "notepad", id: "al", title: "Scratch" } as unknown as Record<string, unknown>
				}
				data={null}
			/>,
		);
		expect(screen.getByLabelText("Scratch")).toBeInTheDocument();
	});

	it("handles special characters in text", () => {
		render(
			<Notepad
				config={{ type: "notepad", id: "sc" } as unknown as Record<string, unknown>}
				data={null}
			/>,
		);
		const area = screen.getByTestId("notepad-area") as HTMLTextAreaElement;
		const special = '<script>alert("xss")</script> & "quotes" \'single\'';
		fireEvent.change(area, { target: { value: special } });
		expect(area.value).toBe(special);
		expect(localStorage.getItem("glimpse.notepad.sc")).toBe(special);
	});

	it("handles very long text", () => {
		render(
			<Notepad
				config={{ type: "notepad", id: "long" } as unknown as Record<string, unknown>}
				data={null}
			/>,
		);
		const area = screen.getByTestId("notepad-area") as HTMLTextAreaElement;
		const long = "x".repeat(10000);
		fireEvent.change(area, { target: { value: long } });
		expect(area.value).toBe(long);
	});

	it("hides the header when hide-header is set", () => {
		render(
			<Notepad
				config={
					{ type: "notepad", id: "hh", title: "Hidden", "hide-header": true } as unknown as Record<
						string,
						unknown
					>
				}
				data={null}
			/>,
		);
		expect(screen.queryByText("Hidden")).toBeNull();
	});
});
