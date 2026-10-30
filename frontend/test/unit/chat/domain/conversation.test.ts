import { describe, expect, it } from "vitest";
import {
	buildChatRequest,
	dropClosedTurn,
	HISTORY_MAX_MESSAGE_CHARS,
	HISTORY_MAX_MESSAGES,
	HISTORY_MAX_TOTAL_CHARS,
	mergeContext,
	trimHistory,
} from "../../../../src/chat/domain/conversation";
import type { ChatMessage } from "../../../../src/chat/types";

const message = (role: ChatMessage["role"], content: string): ChatMessage => ({
	role,
	content,
});

describe("trimHistory", () => {
	it("keeps only the most recent messages", () => {
		const history = Array.from({ length: HISTORY_MAX_MESSAGES + 5 }, (_, index) =>
			message("user", String(index))
		);

		expect(trimHistory(history)).toHaveLength(HISTORY_MAX_MESSAGES);
		expect(trimHistory(history)[0].content).toBe("5");
	});

	it("truncates each message and respects the total limit", () => {
		const history = Array.from({ length: 6 }, () => message("user", "x".repeat(2500)));
		const trimmed = trimHistory(history);

		expect(trimmed.every((item) => item.content.length <= HISTORY_MAX_MESSAGE_CHARS)).toBe(true);
		expect(trimmed.reduce((total, item) => total + item.content.length, 0)).toBe(
			HISTORY_MAX_TOTAL_CHARS
		);
	});

	it("removes an assistant without its preceding user message", () => {
		expect(trimHistory([message("assistant", "orphan"), message("user", "question")])).toEqual([
			message("user", "question"),
		]);
	});

	it("filters invalid messages without mutating the input", () => {
		const history = [
			message("user", "valid"),
			{ role: "system", content: "invalid" },
		] as ChatMessage[];
		const snapshot = [...history];

		expect(trimHistory(history)).toEqual([message("user", "valid")]);
		expect(history).toEqual(snapshot);
	});
});

describe("conversation rules", () => {
	it("builds a trimmed chat request and validates the question", () => {
		expect(buildChatRequest("  hola  ", [message("user", "previous")])).toEqual({
			question: "hola",
			history: [message("user", "previous")],
		});
		expect(() => buildChatRequest("   ", [])).toThrow("QUESTION_EMPTY");
		expect(() => buildChatRequest("x".repeat(1001), [])).toThrow("QUESTION_TOO_LONG");
	});

	it("replaces context with a copied canonical history", () => {
		const history = [message("user", "canonical")];
		const merged = mergeContext(history);
		history[0].content = "changed";

		expect(merged).toEqual([message("user", "canonical")]);
	});
});

describe("dropClosedTurn", () => {
	it("removes the question and the answer of the closed turn", () => {
		const context = [
			message("user", "anterior"),
			message("assistant", "respuesta anterior"),
			message("user", "pregunta"),
			message("assistant", "parcial"),
		];

		expect(dropClosedTurn(context, "pregunta")).toEqual([
			message("user", "anterior"),
			message("assistant", "respuesta anterior"),
		]);
	});

	it("removes a question that was closed without an answer", () => {
		const context = [message("user", "anterior"), message("user", "pregunta")];

		expect(dropClosedTurn(context, "pregunta")).toEqual([message("user", "anterior")]);
	});

	it("leaves a turn it does not own untouched", () => {
		const context = [message("user", "anterior"), message("assistant", "respuesta anterior")];

		expect(dropClosedTurn(context, "otra")).toEqual(context);
		expect(dropClosedTurn(context, null)).toEqual(context);
	});
});
