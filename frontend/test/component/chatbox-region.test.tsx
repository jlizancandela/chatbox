/**
 * RF-F41 — contrato de la región de estado (issue #91).
 *
 * Nivel de verificación: **estructura**, no sonido. Estos tests comprueban qué lleva la
 * región y en qué orden; que un lector de pantalla lo hable es el nivel manual (NVDA y
 * VoiceOver), que es la condición de cierre de la issue. Ver
 * `docs/decisions/005-live-region-verification.md`.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El render de markdown es otra historia (ver `assistant-markdown.test.tsx`) y aquí solo
// estorba: estos tests miran la región de estado, no cómo se pinta la respuesta.
vi.mock("react-markdown", () => ({
	default: ({ children }: { children: string }) => <article>{children}</article>,
}));

import { STORAGE_KEY } from "../../src/chat/infrastructure/storage";
import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";

const sourceFrame = (history: unknown[] = []): string =>
	`event: sources\ndata: ${JSON.stringify({ sources: [], history })}\n\n`;

const tokenFrame = (token: string): string =>
	`event: token\ndata: ${JSON.stringify({ token })}\n\n`;

const doneFrame = "event: done\ndata: {}\n\n";

const streamedAnswer = (...frames: string[]): Response => {
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

const mockStream = (response: Response): void => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
};

const mockFailure = (status: number): void => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
};

const mockHangingRequest = (): void => {
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

/** Registra cada texto distinto que pasa por la región, para fijar la secuencia real. */
const observeRegion = (region: HTMLElement): string[] => {
	const seen = [region.textContent ?? ""];
	const observer = new MutationObserver(() => {
		const next = region.textContent ?? "";
		if (next !== seen[seen.length - 1]) seen.push(next);
	});
	observer.observe(region, { childList: true, characterData: true, subtree: true });

	return seen;
};

const regionOf = (container: Element): HTMLElement =>
	container.querySelector(".chatbox__status") as HTMLElement;

const send = async (question: string): Promise<void> => {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText(strings.input.label), question);
	await user.click(screen.getByRole("button", { name: strings.input.send.ariaLabel }));
};

beforeEach(() => {
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("RF-F41 — una única región de estado", () => {
	it("declares the status role and the polite live region", () => {
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		expect(region).toHaveAttribute("role", "status");
		expect(region).toHaveAttribute("aria-live", "polite");
		expect(region).toHaveAttribute("aria-atomic", "true");
	});

	it("keeps the message list out of the live regions", async () => {
		mockStream(streamedAnswer(sourceFrame(), tokenFrame("Usa Preact."), doneFrame));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(container.querySelector("ol")).toBeInTheDocument());
		expect(container.querySelector("ol")).not.toHaveAttribute("aria-live");
		expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
	});

	it("is empty until the user writes something", () => {
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		expect(regionOf(container)).toHaveTextContent("");
	});
});

describe("RF-F41 — secuencia de un turno completo", () => {
	it("goes from empty to writing to the full answer", async () => {
		mockStream(streamedAnswer(sourceFrame(), tokenFrame("Usa Preact."), doneFrame));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);
		const seen = observeRegion(region);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(region).toHaveTextContent("Usa Preact."));
		expect(seen).toEqual(["", strings.messages.writing, "Usa Preact."]);
	});

	it("announces the answer without its markdown syntax", async () => {
		mockStream(streamedAnswer(sourceFrame(), tokenFrame("Usa **Preact** y `Fastify`."), doneFrame));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(region).toHaveTextContent("Usa Preact y Fastify."));
	});

	it("announces that the assistant has nothing when the answer is empty", async () => {
		mockStream(streamedAnswer(sourceFrame(), doneFrame));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		await send("¿Dónde vive el gato de Jorge?");

		await waitFor(() => expect(region).toHaveTextContent(strings.notices.noContext));
		// El mismo aviso se pinta en la conversación: se anuncia **una** vez, no se duplica.
		const conversation = container.querySelector(".chatbox__conversation") as HTMLElement;
		expect(within(conversation).getByText(strings.notices.noContext)).toBeInTheDocument();
	});

	it("announces the error when the turn fails", async () => {
		mockFailure(500);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(region).toHaveTextContent(strings.errors.HTTP_SERVER));
	});

	it("announces the stop when the user stops the turn", async () => {
		mockHangingRequest();
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		await send("¿Qué usa Jorge?");
		await userEvent.click(
			await screen.findByRole("button", { name: strings.input.stop.ariaLabel })
		);

		await waitFor(() => expect(region).toHaveTextContent(strings.messages.stopped));
	});

	it("announces an identical answer again on the next turn", async () => {
		const answer = "Usa Preact.";
		mockStream(streamedAnswer(sourceFrame(), tokenFrame(answer), doneFrame));
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);

		await send("¿Qué usa Jorge?");
		await waitFor(() => expect(region).toHaveTextContent(answer));

		// La segunda respuesta dice exactamente lo mismo: si el aviso de "escribiendo" no
		// pasara por la región, el texto no cambiaría y el lector no volvería a anunciarlo.
		const seen = observeRegion(region);
		mockStream(streamedAnswer(sourceFrame(), tokenFrame(answer), doneFrame));
		await send("¿Y otra vez?");

		await waitFor(() => expect(region).toHaveTextContent(answer));
		expect(seen).toEqual([answer, strings.messages.writing, answer]);
	});
});

describe("RF-F41 — lo que no se anuncia", () => {
	it("stays silent when a conversation is restored on mount", async () => {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				messages: [{ role: "assistant", content: "Respuesta de la sesión anterior" }],
				context: [],
			})
		);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		// La conversación se restaura (hay lista de mensajes) y aun así la región no dice nada:
		// nadie acaba de escribir ese mensaje en esta sesión.
		await waitFor(() => expect(container.querySelector("ol")).toBeInTheDocument());
		expect(regionOf(container)).toHaveTextContent("");
	});

	it("stays silent when the restored conversation is rendered after a moment", async () => {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				messages: [{ role: "assistant", content: "Respuesta de la sesión anterior" }],
				context: [],
			})
		);
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		const region = regionOf(container);
		const seen = observeRegion(region);

		await waitFor(() => expect(container.querySelector("ol")).toBeInTheDocument());
		expect(seen).toEqual([""]);
	});
});

describe("RF-F41 — el contador de caracteres no es una región viva", () => {
	it("keeps the counter visible but silent", async () => {
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
		await userEvent.type(screen.getByLabelText(strings.input.label), "x".repeat(801));

		const counter = screen.getByText(strings.input.chars(801, 1000));
		expect(counter).toBeInTheDocument();
		expect(counter).toHaveAttribute("aria-live", "off");
		expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
	});

	it("rejects a probe where the counter is a live region again", () => {
		// La guarda de arriba es un test de ausencia: también pasaría si estuviera rota, a menos
		// que alguien demuestre que sabe fallar. Se demostró mutando el componente a mano y
		// revirtiendo; eso no deja rastro y depende de que el revisor se acuerde. Esta sonda
		// fija el criterio —una sola región `polite`— contra el estado roto, sin tocar `src/`.
		const regionesPolite = (counterLive: string): number => {
			const probe = document.createElement("div");
			probe.innerHTML = `<div role="status" aria-live="polite"></div><small aria-live="${counterLive}"></small>`;
			return probe.querySelectorAll('[aria-live="polite"]').length;
		};

		expect(regionesPolite("off")).toBe(1); // contador mudo + región de estado
		expect(regionesPolite("polite")).toBe(2); // el bug: dos regiones compitiendo
	});
});
