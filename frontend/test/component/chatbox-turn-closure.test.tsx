/**
 * #145 — el cierre de un turno no pierde estado.
 *
 * Dos fallos del reducer que el visitante nota: un turno sin respuesta borraba su pregunta
 * del contexto, y abortar descartaba el texto parcial que ya estaba en pantalla. Aquí se
 * verifica lo observable: qué viaja en la petición siguiente y qué sobrevive a una recarga.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFromSessionStorage } from "../../src/chat/infrastructure/storage";
import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";
import {
	answerTurn,
	doneFrame,
	mockPartialThenHang,
	regionOf,
	send,
	sourcesFrame,
	streamedAnswer,
} from "./fixtures";

const requestBody = (
	fetchMock: ReturnType<typeof vi.fn>,
	call: number
): { question: string; history: { role: string; content: string }[] } =>
	JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

describe("#145 — cierre del turno", () => {
	beforeEach(() => sessionStorage.clear());

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		sessionStorage.clear();
	});

	it("sends the question of an unanswered turn as history on the next request", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(streamedAnswer(sourcesFrame(), doneFrame))
			.mockResolvedValueOnce(answerTurn("Usa Preact."));
		vi.stubGlobal("fetch", fetchMock);
		const { container } = render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);

		await send("¿Dónde vive el gato de Jorge?");
		await waitFor(() => expect(regionOf(container)).toHaveTextContent(strings.notices.noContext));
		// El turno vacío no inventa un mensaje del asistente.
		expect(container.querySelectorAll(".chatbox__message--assistant")).toHaveLength(0);

		await send("¿Y en qué trabaja?");
		await waitFor(() => expect(regionOf(container)).toHaveTextContent("Usa Preact."));

		expect(requestBody(fetchMock, 1).history).toEqual([
			{ role: "user", content: "¿Dónde vive el gato de Jorge?" },
		]);
		const thread = screen.getByRole("list", { name: strings.messages.listLabel });
		expect(within(thread).getAllByText("¿Dónde vive el gato de Jorge?")).toHaveLength(1);
	});

	it("keeps the partial answer visible and in the context after a reload", async () => {
		const token = "Jorge trabaja en";
		mockPartialThenHang(token);
		const first = render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);

		await send("¿En qué trabaja Jorge?");
		await waitFor(() => expect(screen.getByText(token)).toBeInTheDocument());
		await userEvent.click(screen.getByRole("button", { name: strings.input.stop.ariaLabel }));
		await waitFor(() =>
			expect(regionOf(first.container)).toHaveTextContent(strings.messages.stopped)
		);

		// Lo que se mostró es lo que se guarda: el parcial es un mensaje, no estado de turno.
		await waitFor(() =>
			expect(loadFromSessionStorage()).toEqual({
				messages: [
					{ role: "user", content: "¿En qué trabaja Jorge?" },
					{ role: "assistant", content: token },
				],
				context: [
					{ role: "user", content: "¿En qué trabaja Jorge?" },
					{ role: "assistant", content: token },
				],
			})
		);

		// Recargar es volver a montar el widget con la misma sesión.
		cleanup();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);

		await waitFor(() => expect(screen.getByText(token)).toBeInTheDocument());
	});
});
