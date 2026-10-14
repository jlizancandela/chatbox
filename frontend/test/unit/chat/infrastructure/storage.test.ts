import { beforeEach, describe, expect, it } from "vitest";
import {
	loadFromSessionStorage,
	STORAGE_KEY,
	saveToSessionStorage,
} from "../../../../src/chat/infrastructure/storage";
import type { ChatMessage } from "../../../../src/chat/types";

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
