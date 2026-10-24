import { describe, expect, it, vi } from "vitest";
import { chatReducer, createInitialChatState } from "../../../../src/chat/application/chat-reducer";
import type { ChatController as HookChatController } from "../../../../src/chat/hooks/useChat";
import { createChatStreamRunner, type TurnEnd } from "../../../../src/chat/hooks/useChatStream";

const createChat = (): HookChatController => {
	let state = createInitialChatState();

	const dispatch = (action: Parameters<typeof chatReducer>[1]): void => {
		state = chatReducer(state, action);
	};

	return {
		get state() {
			return state;
		},
		startTurn: (question) => dispatch({ type: "turn-started", question }),
		receiveSources: (sources, history) => dispatch({ type: "sources-received", sources, history }),
		receiveToken: (token) => dispatch({ type: "token-received", token }),
		completeTurn: () => dispatch({ type: "turn-completed" }),
		failTurn: (error) => dispatch({ type: "turn-failed", error }),
		abortTurn: () => dispatch({ type: "turn-aborted" }),
		restore: (conversation) => dispatch({ type: "state-restored", state: conversation }),
		reset: () => dispatch({ type: "conversation-reset" }),
	};
};

const responseFor = (...events: string[]): Response => {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const event of events) {
				controller.enqueue(new TextEncoder().encode(event));
			}
			controller.close();
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
};

const sourceFrame = (history: unknown[] = [], sources: unknown[] = []): string =>
	`event: sources\ndata: ${JSON.stringify({ sources, history })}\n\n`;

const tokenFrame = (token: string): string =>
	`event: token\ndata: ${JSON.stringify({ token })}\n\n`;

const doneFrame = "event: done\ndata: {}\n\n";

const createRunner = (chat = createChat(), fetchImpl: typeof fetch = vi.fn()) => {
	const events: TurnEnd[] = [];
	const runner = createChatStreamRunner({
		apiUrl: "http://localhost:7000",
		chat,
		fetchImpl,
		onTurnEnd: (event) => events.push(event),
	});

	return { chat, runner, events };
};

const hangingFetch = (): typeof fetch =>
	vi.fn().mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("Aborted", "AbortError"));
				});
			})
	) as unknown as typeof fetch;

describe("useChatStream runner", () => {
	it("sends the request and completes a normal streamed turn", async () => {
		const chat = createChat();
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(
				responseFor(
					sourceFrame([{ role: "user", content: "Anterior" }]),
					tokenFrame("Usa"),
					tokenFrame(" Preact."),
					doneFrame
				)
			);
		const runner = createRunner(chat, fetchImpl).runner;

		await runner.run("¿Qué usa Jorge?");

		expect(fetchImpl).toHaveBeenCalledWith(
			"http://localhost:7000/api/chat",
			expect.objectContaining({ method: "POST" })
		);
		expect(chat.state.turnState).toBe("idle");
		expect(chat.state.messages.at(-1)).toEqual({ role: "assistant", content: "Usa Preact." });
		expect(chat.state.context).toEqual([
			{ role: "user", content: "Anterior" },
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Usa Preact." },
		]);
	});

	it("finishes without adding a response when there is no context", async () => {
		const chat = createChat();
		const runner = createRunner(
			chat,
			vi.fn().mockResolvedValue(responseFor(sourceFrame(), doneFrame))
		).runner;

		await runner.run("Pregunta fuera del perfil");

		expect(chat.state.turnState).toBe("idle");
		expect(chat.state.messages).toHaveLength(1);
		expect(chat.state.context).toEqual([]);
	});

	it.each([400, 413, 429, 500])("maps HTTP %s to a local error", async (status) => {
		const chat = createChat();
		const runner = createRunner(
			chat,
			vi.fn().mockResolvedValue(new Response(null, { status }))
		).runner;

		await runner.run("Pregunta");

		expect(chat.state.turnState).toBe("error");
		expect(chat.state.error?.code).toBe(
			status === 400
				? "HTTP_400"
				: status === 413
					? "HTTP_413"
					: status === 429
						? "HTTP_429"
						: "HTTP_SERVER"
		);
	});

	it("keeps partial text out of context after a stream error", async () => {
		const chat = createChat();
		const runner = createRunner(
			chat,
			vi
				.fn()
				.mockResolvedValue(
					responseFor(
						sourceFrame(),
						tokenFrame("Parcial"),
						'event: error\ndata: {"message":"internal detail"}\n\n'
					)
				)
		).runner;

		await runner.run("Pregunta");

		expect(chat.state.turnState).toBe("error");
		expect(chat.state.currentResponse).toBe("Parcial");
		expect(chat.state.context).toEqual([]);
		expect(chat.state.error?.message).toBe("No he podido completar la respuesta.");
	});

	it("aborts an active request without treating it as a network error", async () => {
		const chat = createChat();
		let rejectFetch!: (reason: unknown) => void;
		const fetchImpl = vi.fn().mockImplementation(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					rejectFetch = reject;
					init?.signal?.addEventListener("abort", () => {
						rejectFetch(new DOMException("Aborted", "AbortError"));
					});
				})
		);
		const runner = createRunner(chat, fetchImpl).runner;
		const request = runner.run("Pregunta");

		runner.abort();
		await request;

		expect(chat.state.turnState).toBe("aborted");
		expect(chat.state.error).toBeNull();
		expect(chat.state.context).toEqual([]);
	});

	it("times out an inactive request", async () => {
		vi.useFakeTimers();
		try {
			const chat = createChat();
			const fetchImpl = vi.fn().mockImplementation(
				(_input: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => {
							reject(new DOMException("Aborted", "AbortError"));
						});
					})
			);
			const runner = createRunner(chat, fetchImpl).runner;
			const request = runner.run("Pregunta");

			await vi.advanceTimersByTimeAsync(30_000);
			await request;

			expect(chat.state.turnState).toBe("error");
			expect(chat.state.error?.code).toBe("TIMEOUT");
		} finally {
			vi.useRealTimers();
		}
	});

	it("fails when the stream closes before done", async () => {
		const chat = createChat();
		const runner = createRunner(
			chat,
			vi.fn().mockResolvedValue(responseFor(sourceFrame(), tokenFrame("Parcial")))
		).runner;

		await runner.run("Pregunta");

		expect(chat.state.error?.code).toBe("INCOMPLETE_STREAM");
		expect(chat.state.context).toEqual([]);
	});
});

// ─── RF-F41: eventos de fin de turno ───────────────────────────────────────────

describe("useChatStream runner — turn end events (RF-F41)", () => {
	it("emits one completed event carrying the text that was rendered", async () => {
		const chat = createChat();
		const { runner, events } = createRunner(
			chat,
			vi
				.fn()
				.mockResolvedValue(
					responseFor(sourceFrame(), tokenFrame("Usa"), tokenFrame(" Preact."), doneFrame)
				)
		);

		await runner.run("¿Qué usa Jorge?");

		expect(events).toEqual([{ kind: "completed", text: "Usa Preact.", sources: [] }]);
		// El texto viaja en el evento porque el estado ya no lo conserva tras `done`.
		expect(chat.state.currentResponse).toBe("");
	});

	it("emits a completed event carrying the sources of the answer", async () => {
		const source = {
			documentId: "cv.md",
			chunkIndex: 0,
			title: "Currículum",
			content: "Preact",
			distance: 0.2,
		};
		const { runner, events } = createRunner(
			createChat(),
			vi
				.fn()
				.mockResolvedValue(
					responseFor(sourceFrame([], [source]), tokenFrame("Usa Preact."), doneFrame)
				)
		);

		await runner.run("¿Qué usa Jorge?");

		expect(events).toEqual([{ kind: "completed", text: "Usa Preact.", sources: [source] }]);
	});

	it("emits a completed event with empty text when the assistant answers nothing", async () => {
		const { runner, events } = createRunner(
			createChat(),
			vi.fn().mockResolvedValue(responseFor(sourceFrame(), doneFrame))
		);

		await runner.run("Pregunta fuera del perfil");

		expect(events).toEqual([{ kind: "completed", text: "", sources: [] }]);
	});

	it.each([
		{
			scenario: "pregunta vacía",
			code: "QUESTION_INVALID",
			fetchImpl: vi.fn(),
			question: "   ",
		},
		{
			scenario: "pregunta demasiado larga",
			code: "QUESTION_INVALID",
			fetchImpl: vi.fn(),
			question: "x".repeat(1001),
		},
		{
			scenario: "error HTTP",
			code: "HTTP_SERVER",
			fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
			question: "Pregunta",
		},
		{
			scenario: "respuesta sin cuerpo",
			code: "NETWORK_ERROR",
			fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
			question: "Pregunta",
		},
		{
			scenario: "evento de error del stream",
			code: "STREAM_ERROR",
			fetchImpl: vi
				.fn()
				.mockResolvedValue(
					responseFor(
						sourceFrame(),
						tokenFrame("Parcial"),
						'event: error\ndata: {"message":"internal detail"}\n\n'
					)
				),
			question: "Pregunta",
		},
		{
			scenario: "stream cerrado antes de done",
			code: "INCOMPLETE_STREAM",
			fetchImpl: vi.fn().mockResolvedValue(responseFor(sourceFrame(), tokenFrame("Parcial"))),
			question: "Pregunta",
		},
	])(
		"emits exactly one failed event when the turn fails: $scenario",
		async ({ code, fetchImpl, question }) => {
			const { runner, events } = createRunner(createChat(), fetchImpl as unknown as typeof fetch);

			await runner.run(question);

			expect(events).toHaveLength(1);
			expect(events[0].kind).toBe("failed");
			expect(events[0].kind === "failed" && events[0].error.code).toBe(code);
		}
	);

	it("emits exactly one aborted event when the user stops the turn", async () => {
		const { runner, events } = createRunner(createChat(), hangingFetch());
		const request = runner.run("Pregunta");

		runner.abort();
		await request;

		expect(events).toEqual([{ kind: "aborted" }]);
	});

	it("emits exactly one aborted event when the request aborts without the button", async () => {
		// El mismo desenlace por otro camino: si solo se cubriera el botón, esta salida —que no
		// pasa por `abort()`— quedaría en silencio.
		const chat = createChat();
		const { runner, events } = createRunner(
			chat,
			vi
				.fn()
				.mockRejectedValue(new DOMException("Aborted", "AbortError")) as unknown as typeof fetch
		);

		await runner.run("Pregunta");

		expect(chat.state.turnState).toBe("aborted");
		expect(events).toEqual([{ kind: "aborted" }]);
	});

	it("emits exactly one failed event on timeout", async () => {
		vi.useFakeTimers();
		try {
			const { runner, events } = createRunner(createChat(), hangingFetch());
			const request = runner.run("Pregunta");

			await vi.advanceTimersByTimeAsync(30_000);
			await request;

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({
				kind: "failed",
				error: { code: "TIMEOUT", message: expect.any(String) },
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not announce a restored conversation", async () => {
		const chat = createChat();
		chat.restore({
			messages: [{ role: "assistant", content: "Respuesta anterior" }],
			context: [],
		});
		const { runner, events } = createRunner(
			chat,
			vi.fn().mockResolvedValue(responseFor(sourceFrame(), doneFrame))
		);

		expect(events).toEqual([]);

		await runner.run("Pregunta");

		expect(events).toEqual([{ kind: "completed", text: "", sources: [] }]);
	});
});
