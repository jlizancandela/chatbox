/**
 * RF-F64 — el estado contraído del widget (variante flotante) — issue #127.
 *
 * Ejercita la costura pública de `Chatbox`: las props que declara el sitio host y lo que
 * una persona ve y alcanza con el teclado. No depende de nombres de componentes internos,
 * del número de hooks ni del número de efectos.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";
import { answerTurn, mockHangingRequest, mockStream, regionOf, send } from "./fixtures";

/** El lanzador: el único control que existe en el estado contraído. */
const launcher = (): HTMLElement =>
	screen.getByRole("button", { name: strings.launcher.open.ariaLabel });

/** El botón de la cabecera que contrae el panel. */
const collapse = (): HTMLElement =>
	screen.getByRole("button", { name: strings.actions.collapse.ariaLabel });

/** El campo de texto: la prueba de que el panel está montado. */
const questionField = (): HTMLElement => screen.getByLabelText(strings.input.label);

describe("RF-F64 — la variante flotante contraída", () => {
	afterEach(cleanup);
	beforeEach(() => vi.restoreAllMocks());

	describe("el estado inicial", () => {
		it("nace contraído: hay lanzador y no hay panel", () => {
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("sin prop de variante, el widget nace flotante y contraído", () => {
			// El defecto del widget es la variante flotante: el sitio lo monta como un
			// lanzador en la esquina sin tener que pedirlo (RF-F64).
			render(<Chatbox apiUrl="http://localhost:7000" />);

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("con initiallyCollapsed={false} nace expandido", () => {
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="floating" initiallyCollapsed={false} />
			);

			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});

		it("la variante embebida no tiene lanzador: nace con el panel", () => {
			render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);

			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});
	});

	describe("abrir y contraer", () => {
		it("el lanzador abre el panel y el lanzador deja de estar", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);

			await user.click(launcher());

			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});

		it("el botón de la cabecera contrae el panel", async () => {
			const user = userEvent.setup();
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="floating" initiallyCollapsed={false} />
			);

			await user.click(collapse());

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("Esc contrae el panel", async () => {
			const user = userEvent.setup();
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="floating" initiallyCollapsed={false} />
			);

			await user.click(questionField());
			await user.keyboard("{Escape}");

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("mientras hay un turno en curso, Esc aborta la respuesta y no contrae el panel", async () => {
			// `Esc` hace lo más urgente: con un turno en marcha, aborta la respuesta (RF-F05).
			// Para recoger el widget está el botón de la cabecera.
			const user = userEvent.setup();
			mockHangingRequest();
			const { container } = render(
				<Chatbox apiUrl="http://localhost:7000" variant="floating" initiallyCollapsed={false} />
			);

			await send("Una pregunta");
			await user.click(questionField());
			await user.keyboard("{Escape}");

			// El turno se detiene: si `Esc` no lo abortara, la región seguiría diciendo que
			// el asistente escribe.
			await waitFor(() => expect(regionOf(container)).toHaveTextContent(strings.messages.stopped));
			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});
	});

	describe("el foco", () => {
		it("al abrir, el foco está en el campo de texto", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);

			await user.click(launcher());

			await waitFor(() => expect(document.activeElement).toBe(questionField()));
		});

		it("al cerrar, el foco vuelve al lanzador", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);

			await user.click(launcher());
			await waitFor(() => expect(document.activeElement).toBe(questionField()));

			await user.keyboard("{Escape}");

			await waitFor(() => expect(document.activeElement).toBe(launcher()));
		});
	});

	describe("contraer no pierde nada", () => {
		it("el borrador sobrevive a la contracción", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);
			await user.click(launcher());

			await user.type(questionField(), "Una pregunta a medias");
			await user.keyboard("{Escape}");
			await user.click(launcher());

			expect(questionField()).toHaveValue("Una pregunta a medias");
		});

		it("la conversación sobrevive a la contracción", async () => {
			const user = userEvent.setup();
			mockStream(answerTurn("Jorge trabaja con TypeScript."));
			render(<Chatbox apiUrl="http://localhost:7000" variant="floating" />);
			await user.click(launcher());

			await send("¿Qué stack usa?");
			await waitFor(() =>
				expect(screen.getByText("Jorge trabaja con TypeScript.")).toBeInTheDocument()
			);

			await user.keyboard("{Escape}");
			await user.click(launcher());

			expect(screen.getByText("Jorge trabaja con TypeScript.")).toBeInTheDocument();
		});

		it("contraer no interrumpe el turno", async () => {
			// Contradir no es detener: el stream sigue y el aviso de escritura se conserva.
			const user = userEvent.setup();
			mockHangingRequest();
			const { container } = render(
				<Chatbox apiUrl="http://localhost:7000" variant="floating" initiallyCollapsed={false} />
			);

			await send("Una pregunta");
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: strings.input.stop.ariaLabel })
				).toBeInTheDocument()
			);

			await user.click(collapse());

			// La región de estado sigue montada y sigue anunciando: contraída no se pinta,
			// pero no sale del árbol de accesibilidad. Si el turno se hubiera interrumpido,
			// diría «Respuesta detenida».
			expect(regionOf(container)).toHaveTextContent(strings.messages.writing);

			// Y el turno sigue vivo: al abrir el panel, el botón de detener está.
			await user.click(launcher());
			expect(
				screen.getByRole("button", { name: strings.input.stop.ariaLabel })
			).toBeInTheDocument();
		});
	});
});
