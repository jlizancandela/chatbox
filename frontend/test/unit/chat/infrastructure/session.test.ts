import { describe, expect, it } from "vitest";
import {
	loadOrCreateSessionId,
	newSessionId,
	rotateSessionId,
	SESSION_HEADER,
	SESSION_STORAGE_KEY,
} from "../../../../src/chat/infrastructure/session";

describe("session id", () => {
	it("generates a different id every time", () => {
		expect(newSessionId()).not.toBe(newSessionId());
	});

	it("uses the same id for the same session", () => {
		const first = loadOrCreateSessionId();
		const second = loadOrCreateSessionId();

		expect(second).toBe(first);
	});

	it("keeps the id in sessionStorage so a reload keeps the budget", () => {
		const id = loadOrCreateSessionId();

		expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(id);
	});

	it("rotating the id starts a new session", () => {
		const before = loadOrCreateSessionId();
		const after = rotateSessionId();

		// Empezar una conversación nueva reinicia el presupuesto del servidor, y eso
		// solo pasa si el identificador cambia (#148).
		expect(after).not.toBe(before);
		expect(loadOrCreateSessionId()).toBe(after);
	});

	it("the header it travels in is the one the server reads", () => {
		expect(SESSION_HEADER).toBe("x-session-id");
	});
});
