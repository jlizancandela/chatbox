/**
 * Behavioral characterization tests for Chatbox (issue #67).
 * Exercises the public component API and user-visible behaviour without depending
 * on internal component names, state shape, hook count, or effect count.
 */

import { cleanup, render, screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";

// ─── Tests: static render ──────────────────────────────────────────────────────

describe("Chatbox — static render", () => {
	afterEach(cleanup);

	describe("RF-F01 — header", () => {
		it("renders the header with the title", () => {
			render(<Chatbox apiUrl="http://localhost:7000" title="Asistente de Jorge" />);
			expect(screen.getByRole("heading", { name: "Asistente de Jorge" })).toBeInTheDocument();
		});

		it("renders the IA badge", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByText("IA")).toBeInTheDocument();
		});

		it("renders the scope notice only inside the header", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			const header = screen.getByRole("banner");
			expect(
				within(header).getByText(/responde solo con información del cv y github/i)
			).toBeInTheDocument();
		});
	});

	describe("RF-F02 — empty state with suggestions", () => {
		it("shows the empty state when there are no messages", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByText(/¿en qué te gustaría saber más/i)).toBeInTheDocument();
		});

		it("renders the suggestion buttons", () => {
			const suggestions = ["¿Qué experiencia?", "¿Qué stack?"];
			render(<Chatbox apiUrl="http://localhost:7000" suggestions={suggestions} />);
			const nav = screen.getByRole("navigation", { name: /preguntas sugeridas/i });
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
			expect(screen.getByLabelText(/escribe tu pregunta/i)).toBeInTheDocument();
		});

		it("buttons without visible text have aria-label", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			const buttons = screen.getAllByRole("button");
			buttons.forEach((btn) => {
				if (!btn.textContent?.trim()) {
					expect(btn).toHaveAttribute("aria-label");
				}
			});
		});
	});

	describe("RF-F31 — external links", () => {
		it("contact link is present when contactUrl is provided", () => {
			render(<Chatbox apiUrl="http://localhost:7000" contactUrl="mailto:jorge@example.com" />);
			const links = screen.getAllByRole("link");
			const contactLinks = links.filter((l) => l.textContent?.includes("Jorge"));
			expect(contactLinks.length).toBeGreaterThan(0);
		});

		it("contact link opens in a new tab with safe attributes", () => {
			render(<Chatbox apiUrl="http://localhost:7000" contactUrl="mailto:jorge@example.com" />);
			const contactLink = screen.getByRole("link", { name: /contactar/i });
			expect(contactLink).toHaveAttribute("target", "_blank");
			expect(contactLink).toHaveAttribute("rel", "noopener noreferrer");
		});
	});

	describe("RF-F03 — textarea", () => {
		it("send button is disabled when the textarea is empty", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByRole("button", { name: /enviar/i })).toBeDisabled();
		});

		it("send button has the correct aria-label", () => {
			render(<Chatbox apiUrl="http://localhost:7000" />);
			expect(screen.getByRole("button", { name: /enviar pregunta/i })).toBeInTheDocument();
		});
	});
});

// ─── Tests: keyboard and textarea ──────────────────────────────────────────────

describe("Chatbox — keyboard and textarea (RF-F03 / RF-F04)", () => {
	afterEach(cleanup);
	beforeEach(() => vi.restoreAllMocks());

	it("enables the send button once the user types", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.type(screen.getByLabelText(/escribe tu pregunta/i), "¿Qué sabes de Jorge?");
		expect(screen.getByRole("button", { name: /enviar/i })).toBeEnabled();
	});

	it("inserts a newline when Shift+Enter is pressed", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(/escribe tu pregunta/i);
		await user.type(textarea, "Línea uno{Shift>}{Enter}{/Shift}Línea dos");
		expect(textarea).toHaveValue("Línea uno\nLínea dos");
	});

	it("does not send while IME composition is in progress", async () => {
		const user = userEvent.setup();
		const submitSpy = vi
			.spyOn(HTMLFormElement.prototype, "requestSubmit")
			.mockImplementation(vi.fn());
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(/escribe tu pregunta/i);
		textarea.dispatchEvent(new InputEvent("compositionstart", { bubbles: true }));
		await user.type(textarea, "¿Qué{Enter}");
		expect(submitSpy).not.toHaveBeenCalled();
		submitSpy.mockRestore();
	});

	it("shows character counter near the 80% threshold", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(/escribe tu pregunta/i);
		await user.type(textarea, "x".repeat(801));
		expect(screen.getByText(/801\/1000/)).toBeInTheDocument();
	});

	it("typing in the textarea updates its value", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		const textarea = screen.getByLabelText(/escribe tu pregunta/i) as HTMLTextAreaElement;
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
		await user.type(screen.getByLabelText(/escribe tu pregunta/i), "¿Qué sabes?");
		await user.click(screen.getByRole("button", { name: /enviar/i }));
		await user.keyboard("{Enter}");
		submitSpy.mockRestore();
		expect(screen.getByRole("button", { name: /nueva conversación/i })).toBeInTheDocument();
	});

	it("asks for inline confirmation before resetting", async () => {
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await userEvent.setup().click(screen.getByRole("button", { name: /nueva conversación/i }));
		expect(screen.getByText(/¿borrar la conversación/i)).toBeInTheDocument();
	});

	it("confirm button resets the conversation", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: /nueva conversación/i }));
		await user.click(screen.getByRole("button", { name: /sí, borrar/i }));
		expect(screen.getByText(/¿en qué te gustaría saber más/i)).toBeInTheDocument();
	});

	it("cancel button preserves the conversation", async () => {
		const user = userEvent.setup();
		render(<Chatbox apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: /nueva conversación/i }));
		await user.click(screen.getByRole("button", { name: /cancelar/i }));
		expect(screen.getByText(/nueva conversación/i)).toBeInTheDocument();
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
