import { describe, expect, it } from "vitest";
import {
	type ChatState,
	chatReducer,
	createInitialChatState,
} from "../../../../src/chat/application/chat-reducer";

const source = {
	documentId: "cv.md",
	chunkIndex: 0,
	title: "Currículum",
	content: "Preact",
	distance: 0.2,
};

const started = (question = "¿Qué usa Jorge?"): ChatState =>
	chatReducer(createInitialChatState(), { type: "turn-started", question });

describe("chatReducer", () => {
	it("starts a turn with a user message", () => {
		const state = started();

		expect(state.turnState).toBe("connecting");
		expect(state.messages).toEqual([{ role: "user", content: "¿Qué usa Jorge?" }]);
		expect(state.currentResponse).toBe("");
	});

	it("syncs canonical history and sources", () => {
		const state = chatReducer(started(), {
			type: "sources-received",
			sources: [source],
			history: [{ role: "user", content: "historial" }],
		});

		expect(state.turnState).toBe("generating");
		expect(state.sources).toEqual([source]);
		expect(state.context).toEqual([{ role: "user", content: "historial" }]);
	});

	it("accumulates tokens and commits a completed turn", () => {
		let state = started();
		state = chatReducer(state, { type: "token-received", token: "Usa " });
		state = chatReducer(state, { type: "token-received", token: "Preact." });
		state = chatReducer(state, { type: "turn-completed" });

		expect(state.turnState).toBe("idle");
		expect(state.messages).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Usa Preact." },
		]);
		expect(state.context).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Usa Preact." },
		]);
	});

	it("keeps the sources with the answer and out of the context", () => {
		let state = started();
		state = chatReducer(state, {
			type: "sources-received",
			sources: [source],
			history: [],
		});
		state = chatReducer(state, { type: "token-received", token: "Usa Preact." });
		state = chatReducer(state, { type: "turn-completed" });

		expect(state.messages[1].sources).toEqual([source]);
		expect(state.context[1]).toEqual({ role: "assistant", content: "Usa Preact." });
	});

	it("keeps the question in the context when the turn ends without an answer", () => {
		const state = chatReducer(started(), { type: "turn-completed" });

		// La pregunta sigue contando aunque el asistente no tenga nada que decir: la
		// siguiente pregunta conserva su referente (#145).
		expect(state.messages).toEqual([{ role: "user", content: "¿Qué usa Jorge?" }]);
		expect(state.context).toEqual([{ role: "user", content: "¿Qué usa Jorge?" }]);
		expect(state.currentResponse).toBe("");
	});

	it("commits the partial answer when the turn is aborted", () => {
		let state = started();
		state = chatReducer(state, { type: "token-received", token: "Usa " });
		state = chatReducer(state, { type: "token-received", token: "Preact" });
		state = chatReducer(state, { type: "turn-aborted", response: "Usa Preact" });

		expect(state.turnState).toBe("aborted");
		expect(state.messages).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Usa Preact" },
		]);
		expect(state.context).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Usa Preact" },
		]);
		expect(state.currentResponse).toBe("");
	});

	it("stores the same turn whether it fails or is aborted", () => {
		const failed = chatReducer(started(), {
			type: "turn-failed",
			error: { code: "STREAM_ERROR", message: "No se pudo completar la respuesta." },
			response: "Parcial",
		});
		const aborted = chatReducer(started(), { type: "turn-aborted", response: "Parcial" });

		expect(failed.messages).toEqual(aborted.messages);
		expect(failed.context).toEqual(aborted.context);
		expect(failed.context).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Parcial" },
		]);
		expect(failed.turnState).toBe("error");
		expect(aborted.turnState).toBe("aborted");
	});

	it("does not invent an empty assistant message when a turn fails", () => {
		const state = chatReducer(started(), {
			type: "turn-failed",
			error: { code: "HTTP_SERVER", message: "No se pudo completar la respuesta." },
		});

		expect(state.messages).toEqual([{ role: "user", content: "¿Qué usa Jorge?" }]);
		expect(state.context).toEqual([{ role: "user", content: "¿Qué usa Jorge?" }]);
		expect(state.currentResponse).toBe("");
	});

	it("does not commit anything when no turn was open", () => {
		const state = chatReducer(createInitialChatState(), {
			type: "turn-failed",
			error: { code: "QUESTION_INVALID", message: "La pregunta no es válida." },
		});

		expect(state.messages).toEqual([]);
		expect(state.context).toEqual([]);
		expect(state.turnState).toBe("error");
	});

	it("retries a failed turn without duplicating the question", () => {
		let state = started();
		state = chatReducer(state, { type: "token-received", token: "Parcial" });
		state = chatReducer(state, {
			type: "turn-failed",
			error: { code: "STREAM_ERROR", message: "No se pudo completar la respuesta." },
			response: "Parcial",
		});
		state = chatReducer(state, { type: "turn-retried" });
		state = chatReducer(state, { type: "token-received", token: "Completa" });
		state = chatReducer(state, { type: "turn-completed" });

		// El intento fallido se reemplaza por el nuevo: no quedan dos preguntas iguales ni
		// dos respuestas para el mismo turno (#145).
		expect(state.messages).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Completa" },
		]);
		expect(state.context).toEqual([
			{ role: "user", content: "¿Qué usa Jorge?" },
			{ role: "assistant", content: "Completa" },
		]);
	});

	it("restores and resets state", () => {
		const restored = chatReducer(createInitialChatState(), {
			type: "state-restored",
			state: {
				messages: [{ role: "user", content: "visible" }],
				context: [{ role: "assistant", content: "context" }],
			},
		});

		expect(restored.messages).toEqual([{ role: "user", content: "visible" }]);
		expect(restored.context).toEqual([{ role: "assistant", content: "context" }]);
		expect(chatReducer(restored, { type: "conversation-reset" })).toEqual(createInitialChatState());
	});
});
