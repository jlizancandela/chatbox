/**
 * RF-F65 — la variante cajón del widget.
 *
 * Ejercita la costura pública de `Chatbox`: las props que declara el sitio host y lo que
 * una persona ve y alcanza con el teclado. No depende de nombres de componentes internos,
 * del número de hooks ni del número de efectos.
 *
 * El nivel de resolución —la geometría real del panel pegado al borde derecho— vive en
 * `test/browser/drawer.spec.ts`; jsdom no mide.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/preact";
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

/** La raíz del widget: es la que declara la variante. */
const root = (container: Element): HTMLElement =>
	container.querySelector(".chatbox") as HTMLElement;

/**
 * El hilo de la conversación, con sus consultas acotadas.
 *
 * El texto de una respuesta vive **también** en la región de estado —`role="status"`—,
 * que lo anuncia (RF-F41). Buscarlo en toda la página lo encuentra dos veces, y cuál de
 * las dos responde depende de cuándo se cargue el markdown: el hilo es donde el mensaje
 * está de verdad.
 */
const thread = (): ReturnType<typeof within> =>
	within(screen.getByRole("list", { name: strings.messages.listLabel }));

describe("RF-F65 — la variante cajón", () => {
	afterEach(cleanup);
	beforeEach(() => vi.restoreAllMocks());

	describe("la variante que se monta", () => {
		it("la raíz declara la variante cajón", () => {
			const { container } = render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);

			expect(root(container)).toHaveAttribute("data-variant", "drawer");
		});

		it("nace contraído: hay lanzador y no hay panel", () => {
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("con initiallyCollapsed={false} nace expandido", () => {
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="drawer" initiallyCollapsed={false} />
			);

			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});

		it("la variante embebida no declara variante: sigue siendo la que no tiene lanzador", () => {
			// La embebida no cambia: ni su DOM ni su comportamiento (RF-F65, D2).
			const { container } = render(<Chatbox apiUrl="http://localhost:7000" variant="embedded" />);

			expect(root(container)).not.toHaveAttribute("data-variant");
			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});
	});

	describe("abrir y contraer", () => {
		it("el lanzador abre el panel y el lanzador deja de estar", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);

			await user.click(launcher());

			expect(questionField()).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		});

		it("el botón de la cabecera contrae el panel", async () => {
			const user = userEvent.setup();
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="drawer" initiallyCollapsed={false} />
			);

			await user.click(collapse());

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("Esc contrae el panel", async () => {
			const user = userEvent.setup();
			render(
				<Chatbox apiUrl="http://localhost:7000" variant="drawer" initiallyCollapsed={false} />
			);

			await user.click(questionField());
			await user.keyboard("{Escape}");

			expect(launcher()).toBeInTheDocument();
			expect(screen.queryByLabelText(strings.input.label)).not.toBeInTheDocument();
		});

		it("mientras hay un turno en curso, Esc aborta la respuesta y no contrae el panel", async () => {
			// `Esc` hace lo más urgente: con un turno en marcha, aborta la respuesta (RF-F05).
			const user = userEvent.setup();
			mockHangingRequest();
			const { container } = render(
				<Chatbox apiUrl="http://localhost:7000" variant="drawer" initiallyCollapsed={false} />
			);

			await send("Una pregunta");
			await user.click(questionField());
			await user.keyboard("{Escape}");

			await waitFor(() => expect(regionOf(container)).toHaveTextContent(strings.messages.stopped));
			expect(questionField()).toBeInTheDocument();
		});
	});

	describe("el foco", () => {
		it("al abrir, el foco está en el campo de texto", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);

			await user.click(launcher());

			await waitFor(() => expect(document.activeElement).toBe(questionField()));
		});

		it("al cerrar, el foco vuelve al lanzador", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);

			await user.click(launcher());
			await waitFor(() => expect(document.activeElement).toBe(questionField()));

			await user.keyboard("{Escape}");

			await waitFor(() => expect(document.activeElement).toBe(launcher()));
		});
	});

	describe("contraer no pierde nada", () => {
		it("el borrador sobrevive a la contracción", async () => {
			const user = userEvent.setup();
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);
			await user.click(launcher());

			await user.type(questionField(), "Una pregunta a medias");
			await user.keyboard("{Escape}");
			await user.click(launcher());

			expect(questionField()).toHaveValue("Una pregunta a medias");
		});

		it("contraer no interrumpe el turno", async () => {
			// Contradir no es detener: el stream sigue y el aviso de escritura se conserva.
			const user = userEvent.setup();
			mockHangingRequest();
			const { container } = render(
				<Chatbox apiUrl="http://localhost:7000" variant="drawer" initiallyCollapsed={false} />
			);

			await send("Una pregunta");
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: strings.input.stop.ariaLabel })
				).toBeInTheDocument()
			);

			await user.click(collapse());

			expect(regionOf(container)).toHaveTextContent(strings.messages.writing);

			await user.click(launcher());
			expect(
				screen.getByRole("button", { name: strings.input.stop.ariaLabel })
			).toBeInTheDocument();
		});

		it("la conversación sobrevive a la contracción", async () => {
			const user = userEvent.setup();
			mockStream(answerTurn("Jorge trabaja con TypeScript."));
			render(<Chatbox apiUrl="http://localhost:7000" variant="drawer" />);
			await user.click(launcher());

			await send("¿Qué stack usa?");
			await waitFor(() =>
				expect(thread().getByText("Jorge trabaja con TypeScript.")).toBeInTheDocument()
			);

			await user.keyboard("{Escape}");
			await user.click(launcher());

			// El markdown del asistente se carga diferido (RF-F30): el mensaje está en el
			// hilo, pero su texto aparece cuando el módulo resuelve.
			await waitFor(() =>
				expect(thread().getByText("Jorge trabaja con TypeScript.")).toBeInTheDocument()
			);
		});
	});
});
