import { beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage } from "../types";
import {
	buildChatRequest,
	createConversationStore,
	HISTORY_MAX_MESSAGE_CHARS,
	HISTORY_MAX_MESSAGES,
	HISTORY_MAX_TOTAL_CHARS,
	loadFromSessionStorage,
	mergeContext,
	STORAGE_KEY,
	saveToSessionStorage,
	trimHistory,
} from "./conversation";

const message = (role: ChatMessage["role"], content: string): ChatMessage => ({
	role,
	content,
});

const createStorage = () => {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: (index: number) => [...values.keys()][index] ?? null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
	};
};

beforeEach(() => {
	Object.defineProperty(globalThis, "sessionStorage", {
		configurable: true,
		value: createStorage(),
	});
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

describe("conversation state", () => {
	it("keeps visible messages and context separate", () => {
		const store = createConversationStore();
		store.addMessage(message("user", "visible"));
		store.setContext([message("assistant", "context")]);

		expect(store.getState()).toEqual({
			messages: [message("user", "visible")],
			context: [message("assistant", "context")],
		});
	});

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

describe("session storage", () => {
	it("round-trips messages and context under the versioned key", () => {
		const messages = [message("user", "visible")];
		const context = [message("assistant", "context")];

		expect(saveToSessionStorage(messages, context)).toBe(true);
		expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
		expect(loadFromSessionStorage()).toEqual({ messages, context });
	});

	it("returns null for corrupt or incomplete data", () => {
		sessionStorage.setItem(STORAGE_KEY, "not-json");
		expect(loadFromSessionStorage()).toBeNull();

		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: [] }));
		expect(loadFromSessionStorage()).toBeNull();
	});
});
