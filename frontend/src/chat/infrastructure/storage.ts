import type { ConversationState } from "../domain/conversation";
import type { ChatMessage } from "../types";

export const STORAGE_KEY = "chatbox:v1";

const isChatMessage = (value: unknown): value is ChatMessage => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		(candidate.role === "user" || candidate.role === "assistant") &&
		typeof candidate.content === "string"
	);
};

const copyMessage = (message: ChatMessage): ChatMessage => ({
	role: message.role,
	content: message.content,
});

export const saveToSessionStorage = (
	messages: readonly ChatMessage[],
	context: readonly ChatMessage[]
): boolean => {
	try {
		if (typeof sessionStorage === "undefined") {
			return false;
		}

		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				messages: messages.filter(isChatMessage).map(copyMessage),
				context: context.filter(isChatMessage).map(copyMessage),
			})
		);
		return true;
	} catch {
		return false;
	}
};

export const loadFromSessionStorage = (): ConversationState | null => {
	try {
		if (typeof sessionStorage === "undefined") {
			return null;
		}

		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}

		const candidate = parsed as Record<string, unknown>;
		if (!Array.isArray(candidate.messages) || !Array.isArray(candidate.context)) {
			return null;
		}

		return {
			messages: candidate.messages.filter(isChatMessage).map(copyMessage),
			context: candidate.context.filter(isChatMessage).map(copyMessage),
		};
	} catch {
		return null;
	}
};
