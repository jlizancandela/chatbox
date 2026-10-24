/**
 * Las fuentes de la respuesta (issue #110): el widget nombra los documentos de los que
 * viene cada respuesta, y la región de estado los anuncia junto con la respuesta.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El render de markdown se carga diferido y aquí solo estorba: estos tests miran las
// fuentes de la respuesta, no cómo se pinta el markdown.
vi.mock("react-markdown", () => ({
	default: ({ children }: { children: string }) => <article>{children}</article>,
}));

import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";
import {
	doneFrame,
	mockStream,
	regionOf,
	send,
	sourcesFrame,
	streamedAnswer,
	tokenFrame,
} from "./fixtures";

const source = (title: string, chunkIndex = 0) => ({
	documentId: `${title}.md`,
	chunkIndex,
	title,
	content: "fragmento",
	distance: 0.2,
});

beforeEach(() => {
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Chatbox — sources of the answer", () => {
	it("names the documents the answer comes from, without repeating them", async () => {
		mockStream(
			streamedAnswer(
				sourcesFrame(
					[],
					[source("Currículum", 0), source("Currículum", 1), source("Informe de GitHub", 0)]
				),
				tokenFrame("Usa Preact."),
				doneFrame
			)
		);

		render(<Chatbox apiUrl="http://localhost:7000" />);
		await send("¿Qué usa Jorge?");

		const conversation = await screen.findByRole("list", {
			name: strings.messages.listLabel,
		});
		expect(
			within(conversation).getByText(strings.messages.sources(["Currículum", "Informe de GitHub"]))
		).toBeInTheDocument();
	});

	it("announces the sources with the answer", async () => {
		mockStream(
			streamedAnswer(sourcesFrame([], [source("Currículum")]), tokenFrame("Usa Preact."), doneFrame)
		);

		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		await send("¿Qué usa Jorge?");

		await waitFor(() => {
			expect(regionOf(container).textContent).toContain(strings.messages.sources(["Currículum"]));
		});
	});

	it("does not show a sources line when the answer has no sources", async () => {
		mockStream(streamedAnswer(sourcesFrame(), tokenFrame("Hola."), doneFrame));

		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		await send("¿Qué usa Jorge?");

		await waitFor(() => {
			expect(regionOf(container).textContent).toContain("Hola.");
		});
		expect(screen.queryByText(/Fuentes:/)).toBeNull();
	});
});
