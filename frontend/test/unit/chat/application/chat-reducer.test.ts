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

	it("does not commit a turn without a response", () => {
		const state = chatReducer(started(), { type: "turn-completed" });

		expect(state.messages).toHaveLength(1);
		expect(state.context).toEqual([]);
	});

	it("keeps incomplete responses out of context on error or abort", () => {
		let errored = chatReducer(started(), { type: "token-received", token: "Parcial" });
		errored = chatReducer(errored, {
			type: "turn-failed",
			error: { code: "STREAM_ERROR", message: "No se pudo completar la respuesta." },
		});
		expect(errored.turnState).toBe("error");
		expect(errored.context).toEqual([]);

		const aborted = chatReducer(started(), { type: "turn-aborted" });
		expect(aborted.turnState).toBe("aborted");
		expect(aborted.context).toEqual([]);
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
