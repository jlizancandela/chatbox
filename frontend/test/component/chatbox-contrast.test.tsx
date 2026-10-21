/**
 * RF-F42 — la variante de error de la región de estado (issue #96).
 *
 * Nivel de verificación: **estructura**. Estos tests comprueban que la región lleva la
 * variante de error cuando el turno falla, que no la lleva en ningún otro desenlace, y que
 * el texto que anuncia no cambia. El color resuelto lo verifica la suite de navegador
 * (`test/browser/contrast.spec.ts`). Ver
 * `docs/decisions/006-contrato-y-verificacion-de-contraste.md`.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El render de markdown no pinta nada en estos casos y estorba: aquí se mira la región.
vi.mock("react-markdown", () => ({
	default: ({ children }: { children: string }) => <article>{children}</article>,
}));

import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";
import {
	answerTurn,
	mockFailure,
	mockHangingRequest,
	mockStream,
	regionOf,
	send,
} from "./fixtures";

/** La clase que marca la región como error. Vive en un solo sitio del test. */
const ERROR_CLASS = "chatbox__status--error";

beforeEach(() => {
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("RF-F42 — la variante de error de la región de estado", () => {
	it("marks the region as an error when the turn fails", async () => {
		mockFailure(500);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(regionOf(container)).toHaveClass(ERROR_CLASS));
	});

	it("announces the same text it announced before the variant existed", async () => {
		mockFailure(500);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");

		// El color cambia; el texto no. El anuncio de RF-F41 es el mismo.
		await waitFor(() => expect(regionOf(container)).toHaveTextContent(strings.errors.HTTP_SERVER));
	});

	it("does not mark the region as an error when the answer arrives", async () => {
		mockStream(answerTurn("Usa Preact."));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(regionOf(container)).toHaveTextContent("Usa Preact."));
		expect(regionOf(container)).not.toHaveClass(ERROR_CLASS);
	});

	it("does not mark the region as an error when the user stops the turn", async () => {
		mockHangingRequest();
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");
		await userEvent.click(
			await screen.findByRole("button", { name: strings.input.stop.ariaLabel })
		);

		await waitFor(() => expect(regionOf(container)).toHaveTextContent(strings.messages.stopped));
		expect(regionOf(container)).not.toHaveClass(ERROR_CLASS);
	});

	it("clears the error variant when a new turn starts", async () => {
		mockFailure(500);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		await send("¿Qué usa Jorge?");
		await waitFor(() => expect(regionOf(container)).toHaveClass(ERROR_CLASS));

		mockStream(answerTurn("Usa Preact."));
		await send("¿Y de qué trabaja?");

		await waitFor(() => expect(regionOf(container)).toHaveTextContent("Usa Preact."));
		expect(regionOf(container)).not.toHaveClass(ERROR_CLASS);
	});
});
