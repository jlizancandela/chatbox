/**
 * Behavioral characterization tests for Chatbox (issue #67).
 * Exercises the public component API and user-visible behaviour without depending
 * on internal component names, state shape, hook count, or effect count.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";
import { withoutAccessibleName } from "../accessible-names";
import { mockHangingRequest, regionOf, send } from "./fixtures";

// ─── Tests: static render ──────────────────────────────────────────────────────

describe("Chatbox — static render", () => {
	afterEach(cleanup);

	describe("RF-F01 — header", () => {
		it("renders the header with the title", () => {
			render(<Chatbox apiUrl="http://localhost:7000" title={strings.header.defaultTitle} />);
			expect(
				screen.getByRole("heading", { name: strings.header.defaultTitle })
			).toBeInTheDocument();
		});

		it("renders the IA badge", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByText(strings.header.badge)).toBeInTheDocument();
		});

		it("renders the scope notice only inside the header", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			const header = screen.getByRole("banner");
			expect(within(header).getByText(strings.header.scopeNotice)).toBeInTheDocument();
		});
	});

	describe("RF-F02 — empty state with suggestions", () => {
		it("shows the empty state when there are no messages", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByText(strings.emptyState.prompt)).toBeInTheDocument();
		});

		it("renders the suggestion buttons", () => {
			const suggestions = ["¿Qué experiencia?", "¿Qué stack?"];
			render(<Chatbox apiUrl="http://localhost:7000" suggestions={suggestions} />);
			const nav = screen.getByRole("navigation", { name: strings.a11y.emptyStateNavLabel });
			const buttons = within(nav).getAllByRole("button");
			expect(buttons.map((b) => b.textContent?.trim())).toEqual(suggestions);
		});
	});

	describe("RF-F45 — accessibility labels", () => {
		it("root element has lang='es'", () => {
			const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);
			const root = container.querySelector(".chatbox");
			expect(root).toHaveAttribute("lang", "es");
		});

		it("textarea has an associated label", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByLabelText(strings.input.label)).toBeInTheDocument();
		});

		it("every button has an accessible name", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			const buttons = screen.getAllByRole("button");
			expect(buttons.length).toBeGreaterThan(0);

			for (const button of buttons) {
				expect(
					withoutAccessibleName(button),
					`el botón «${button.outerHTML}» no tiene nombre accesible`
				).toBe(false);
			}
		});

		it("un botón de icono sin nombre se queda sin nombre", () => {
			// La entrada que rechaza. Sin ella, la comprobación de arriba pasaría con un
			// widget lleno de botones mudos: es el caso de RF-F45, un botón cuyo único
			// contenido es decorativo y no lo nombra.
			render(
				<button type="button">
					<span aria-hidden="true">×</span>
				</button>
			);

			expect(withoutAccessibleName(screen.getByRole("button"))).toBe(true);
		});
	});

	describe("RF-F31 — external links", () => {
		it("contact link is present when contactUrl is provided", () => {
			render(<Chatbox apiUrl="http://localhost:7000" contactUrl="mailto:jorge@example.com" />);
			const contactLinks = screen.getAllByRole("link", { name: strings.input.contactLink });
			expect(contactLinks.length).toBeGreaterThan(0);
		});

		it("contact link opens in a new tab with safe attributes", () => {
			render(<Chatbox apiUrl="http://localhost:7000" contactUrl="mailto:jorge@example.com" />);
			const contactLink = screen.getByRole("link", { name: strings.input.contactLink });
			expect(contactLink).toHaveAttribute("target", "_blank");
			expect(contactLink).toHaveAttribute("rel", "noopener noreferrer");
		});
	});

	describe("RF-F03 — textarea", () => {
		it("send button is disabled when the textarea is empty", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByRole("button", { name: strings.input.send.ariaLabel })).toBeDisabled();
		});

		it("send button has the correct aria-label", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(
				screen.getByRole("button", { name: strings.input.send.ariaLabel })
			).toBeInTheDocument();
		});
	});
});

// ─── Tests: keyboard and textarea ──────────────────────────────────────────────

describe("Chatbox — keyboard and textarea (RF-F03 / RF-F04)", () => {
	it("focuses the rendered textarea on mount", () => {
		render(<Chatbox apiUrl="http://localhost:7000" />);
		expect(document.activeElement).toBe(screen.getByLabelText(strings.input.label));
	});
	afterEach(cleanup);
	beforeEach(() => vi.restoreAllMocks());

	it("enables the send button once the user types", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.type(screen.getByLabelText(strings.input.label), "¿Qué sabes de Jorge?");
		expect(screen.getByRole("button", { name: strings.input.send.ariaLabel })).toBeEnabled();
	});

	it("inserts a newline when Shift+Enter is pressed", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(strings.input.label);
		await user.type(textarea, "Línea uno{Shift>}{Enter}{/Shift}Línea dos");
		expect(textarea).toHaveValue("Línea uno\nLínea dos");
	});

	it("does not send while IME composition is in progress", async () => {
		const user = userEvent.setup();
		const submitSpy = vi
			.spyOn(HTMLFormElement.prototype, "requestSubmit")
			.mockImplementation(vi.fn());
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(strings.input.label);
		textarea.dispatchEvent(new InputEvent("compositionstart", { bubbles: true }));
		await user.type(textarea, "¿Qué{Enter}");
		expect(submitSpy).not.toHaveBeenCalled();
		submitSpy.mockRestore();
	});

	it("shows character counter near the 80% threshold", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(strings.input.label);
		await user.type(textarea, "x".repeat(801));
		expect(screen.getByText(strings.input.chars(801, 1000))).toBeInTheDocument();
	});

	it("typing in the textarea updates its value", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(strings.input.label) as HTMLTextAreaElement;
		await user.type(textarea, "¿Qué sabes?");
		expect(textarea.value).toBe("¿Qué sabes?");
	});
});

// ─── Tests: new conversation (RF-F24 / RF-F25) ─────────────────────────────────

describe("Chatbox — new conversation (RF-F24 / RF-F25)", () => {
	afterEach(cleanup);
	beforeEach(() => vi.restoreAllMocks());

	it("shows the 'Nueva conversación' button when messages exist", async () => {
		const user = userEvent.setup();
		const submitSpy = vi
			.spyOn(HTMLFormElement.prototype, "requestSubmit")
			.mockImplementation(vi.fn());
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.type(screen.getByLabelText(strings.input.label), "¿Qué sabes?");
		await user.click(screen.getByRole("button", { name: strings.input.send.ariaLabel }));
		await user.keyboard("{Enter}");
		submitSpy.mockRestore();
		expect(
			screen.getByRole("button", { name: strings.actions.newConversation })
		).toBeInTheDocument();
	});

	it("asks for inline confirmation before resetting", async () => {
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: strings.actions.newConversation }));
		expect(screen.getByText(strings.actions.confirm.question)).toBeInTheDocument();
	});

	it("confirm button resets the conversation", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: strings.actions.newConversation }));
		await user.click(screen.getByRole("button", { name: strings.actions.confirm.accept }));
		expect(screen.getByText(strings.emptyState.prompt)).toBeInTheDocument();
		expect(document.activeElement).toBe(screen.getByLabelText(strings.input.label));
	});

	it("cancel button preserves the conversation", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: strings.actions.newConversation }));
		await user.click(screen.getByRole("button", { name: strings.actions.confirm.cancel }));
		expect(screen.getByText(strings.actions.newConversation)).toBeInTheDocument();
	});
});

// ─── Tests: RF-F44 — indicador de escritura ─────────────────────────────────────

describe("Chatbox — indicador de escritura (RF-F44)", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		sessionStorage.clear();
	});

	it("shows three decorative dots while the assistant writes", async () => {
		// La petición se queda en el aire: el turno queda en curso y existe la burbuja
		// vacía del asistente.
		mockHangingRequest();
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(container.querySelector(".chatbox__typing")).toBeInTheDocument());
		expect(container.querySelector(".chatbox__typing")).toHaveAttribute("aria-hidden", "true");
		expect(container.querySelectorAll(".chatbox__typing-dot")).toHaveLength(3);
	});

	it("shows the writing notice inside the assistant bubble, decoratively", async () => {
		// RF-F47: el aviso se ve dentro del bocadillo y la región solo lo anuncia.
		mockHangingRequest();
		const { container } = render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué usa Jorge?");

		await waitFor(() => expect(container.querySelector(".chatbox__typing")).toBeInTheDocument());
		const bubble = container.querySelector(".chatbox__message--assistant");
		expect(bubble, "el bocadillo del asistente tiene que estar").not.toBeNull();
		const notice = bubble?.querySelector(".chatbox__writing");
		expect(notice).toHaveTextContent(strings.messages.writing);
		// Decorativa: la región de estado es la única que anuncia.
		expect(notice).toHaveAttribute("aria-hidden", "true");
		// Lo que dice la región no cambia: cambia si se pinta.
		const region = regionOf(container);
		expect(region).toHaveTextContent(strings.messages.writing);
		expect(region).toHaveClass("chatbox__status--announced");
	});
});

// ─── Tests: conversation state (cross-reference to unit tests) ──────────────────

describe("Chatbox — conversation state unit coverage (RF-F20-26)", () => {
	afterEach(cleanup);

	it("chatReducer: adds user message on turn-started", () => {
		// Covered by test/unit/chat/application/chat-reducer.test.ts
	});

	it("trimHistory respects limits", () => {
		// Covered by test/unit/chat/domain/conversation.test.ts
	});

	it("sources-received merges context from server", () => {
		// Covered by test/unit/chat/application/chat-reducer.test.ts
	});

	it("turn-completed adds the assistant message to context", () => {
		// Covered by test/unit/chat/application/chat-reducer.test.ts
	});

	it("no-context message shown when done with empty sources and no tokens", () => {
		// Covered by test/unit/chat/application/chat-reducer.test.ts
	});

	it("sessionStorage round-trip preserves messages and context", () => {
		// Covered by test/unit/chat/infrastructure/storage.test.ts
	});
});

// ─── Tests: retry after a failed turn ------------------------------------------

describe("Chatbox — retry after an error", () => {
	beforeEach(() => sessionStorage.clear());

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		sessionStorage.clear();
	});

	it("retries the same question without duplicating the user message", async () => {
		const user = userEvent.setup();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 500 }))
			.mockImplementationOnce(
				(_input: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("Aborted", "AbortError"))
						);
					})
			);
		vi.stubGlobal("fetch", fetchMock);
		render(<Chatbox apiUrl="http://localhost:7000" />);

		await send("¿Qué sabe?");
		await waitFor(() => expect(screen.getByText(strings.errors.HTTP_SERVER)).toBeInTheDocument());

		const messages = screen.getByRole("list", { name: strings.messages.listLabel });
		expect(within(messages).getAllByText("¿Qué sabe?")).toHaveLength(1);

		await user.click(screen.getByRole("button", { name: strings.actions.retry }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: strings.input.stop.ariaLabel })).toBeInTheDocument()
		);
		expect(screen.getByRole("status")).toHaveTextContent(strings.messages.writing);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(within(messages).getAllByText("¿Qué sabe?")).toHaveLength(1);

		await user.click(screen.getByRole("button", { name: strings.input.stop.ariaLabel }));
		await waitFor(() => expect(screen.getByText(strings.messages.stopped)).toBeInTheDocument());
	});
});
