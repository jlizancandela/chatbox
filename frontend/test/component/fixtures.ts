/**
 * Ayudantes de los tests de componente del chatbox: los frames SSE, la intercepción de
 * `fetch` en jsdom y las consultas al widget.
 *
 * Compartidos por la verificación de la región de estado (RF-F41) y la del contraste
 * (RF-F42) para que un cambio en el guion de un turno no se aplique solo a uno de ellos.
 */

import { screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { strings } from "../../src/strings.es";
import { doneFrame, sourcesFrame, tokenFrame } from "../chat-frames";

export { doneFrame, sourcesFrame, tokenFrame };

/** Un `Response` con los frames SSE dados, listo para ser el resultado de `fetch`. */
export const streamedAnswer = (...frames: string[]): Response => {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const frame of frames) {
				controller.enqueue(new TextEncoder().encode(frame));
			}
			controller.close();
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
};

/** El turno completo de una respuesta: fuentes, un token y el cierre. */
export const answerTurn = (answer: string): Response =>
	streamedAnswer(sourcesFrame(), tokenFrame(answer), doneFrame);

export const mockStream = (response: Response): void => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
};

export const mockFailure = (status: number): void => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
};

/** Una petición que no responde nunca: sirve para abortar el turno con el botón. */
export const mockHangingRequest = (): void => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockImplementation(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					});
				})
		)
	);
};

/**
 * Registra cada texto distinto que pasa por la región, para fijar la secuencia real de un
 * turno.
 */
export const observeRegion = (region: HTMLElement): string[] => {
	const seen = [region.textContent ?? ""];
	const observer = new MutationObserver(() => {
		const next = region.textContent ?? "";
		if (next !== seen[seen.length - 1]) seen.push(next);
	});
	observer.observe(region, { childList: true, characterData: true, subtree: true });

	return seen;
};

export const regionOf = (container: Element): HTMLElement =>
	container.querySelector(".chatbox__status") as HTMLElement;

export const send = async (question: string): Promise<void> => {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText(strings.input.label), question);
	await user.click(screen.getByRole("button", { name: strings.input.send.ariaLabel }));
};
