/**
 * Keyboard behaviour of Chatbox (RF-F40, issues #87 and #88).
 * Covers Enter/Escape during a streamed answer and focus transitions in the
 * "Nueva conversación" confirmation.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";
import { strings } from "../../src/strings.es";

const encoder = new TextEncoder();
const sourcesFrame = `event: sources\ndata: ${JSON.stringify({ sources: [], history: [] })}\n\n`;

let openStream: ReadableStreamDefaultController<Uint8Array> | undefined;

const abortError = (): Error => {
	const error = new Error("Aborted");
	error.name = "AbortError";
	return error;
};

// Stream that stays open after the first frames, so the turn remains busy.
function stubOpenStream(): { requestSignal: () => AbortSignal | undefined } {
	let signal: AbortSignal | undefined;
	vi.stubGlobal(
		"fetch",
		vi.fn((_url: string, init?: RequestInit) => {
			signal = init?.signal ?? undefined;
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					openStream = controller;
					controller.enqueue(encoder.encode(sourcesFrame));
					signal?.addEventListener("abort", () => controller.error(abortError()));
				},
			});
			return Promise.resolve(
				new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				})
			);
		})
	);
	return { requestSignal: () => signal };
}

async function startStreamingTurn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	const textarea = screen.getByLabelText(strings.input.label);
	await user.type(textarea, "Primera pregunta{Enter}");
	await waitFor(() =>
		expect(screen.getByRole("button", { name: strings.input.stop.ariaLabel })).toBeInTheDocument()
	);
}

describe("Chatbox — keyboard during a streamed answer (RF-F40 / #87)", () => {
	afterEach(() => {
		openStream?.error(abortError());
		openStream = undefined;
		cleanup();
		vi.unstubAllGlobals();
	});

	it("Enter does not abort the answer in progress", async () => {
		const user = userEvent.setup();
		const { requestSignal } = stubOpenStream();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await startStreamingTurn(user);

		const textarea = screen.getByLabelText(strings.input.label) as HTMLTextAreaElement;
		await user.type(textarea, "segunda");
		await user.keyboard("{Enter}");

		expect(requestSignal()?.aborted).toBe(false);
		expect(textarea.value).toBe("segunda");
	});

	it("Escape aborts the answer in progress", async () => {
		const user = userEvent.setup();
		const { requestSignal } = stubOpenStream();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await startStreamingTurn(user);

		await user.keyboard("{Escape}");

		expect(requestSignal()?.aborted).toBe(true);
	});

	it("the stop button aborts the answer in progress", async () => {
		const user = userEvent.setup();
		const { requestSignal } = stubOpenStream();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await startStreamingTurn(user);

		await user.click(screen.getByRole("button", { name: strings.input.stop.ariaLabel }));

		expect(requestSignal()?.aborted).toBe(true);
	});
});

describe("Chatbox — focus in the new conversation confirmation (RF-F40 / #88)", () => {
	afterEach(cleanup);

	it("moves focus to 'Cancelar' when the confirmation opens", async () => {
		const user = userEvent.setup();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: strings.actions.newConversation }));

		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("button", { name: strings.actions.confirm.cancel })
			)
		);
	});

	it("returns focus to 'Nueva conversación' when the confirmation is cancelled", async () => {
		const user = userEvent.setup();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: strings.actions.newConversation }));
		await user.click(screen.getByRole("button", { name: strings.actions.confirm.cancel }));

		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("button", { name: strings.actions.newConversation })
			)
		);
	});

	it("moves focus to the textarea when the confirmation is accepted", async () => {
		const user = userEvent.setup();
		render(<Chatbox variant="embedded" apiUrl="http://localhost:7000" />);
		await user.click(screen.getByRole("button", { name: strings.actions.newConversation }));
		await user.click(screen.getByRole("button", { name: strings.actions.confirm.accept }));

		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByLabelText(strings.input.label))
		);
	});
});
