import { type ConversationState, isChatMessage, isVisibleMessage } from "../domain/conversation";
import type { ChatMessage, VisibleMessage } from "../types";

export const STORAGE_KEY = "chatbox:v1";

const copyMessage = (message: ChatMessage): ChatMessage => ({
	role: message.role,
	content: message.content,
});

/**
 * El mensaje visible conserva sus fuentes: sin ellas, una conversación restaurada
 * mostraría respuestas sin atribución.
 */
const copyVisibleMessage = (message: VisibleMessage): VisibleMessage => ({
	role: message.role,
	content: message.content,
	...(message.sources ? { sources: message.sources.map((source) => ({ ...source })) } : {}),
});

export const saveToSessionStorage = (
	messages: readonly VisibleMessage[],
	context: readonly ChatMessage[]
): boolean => {
	try {
		if (typeof sessionStorage === "undefined") {
			return false;
		}

		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				messages: messages.filter(isVisibleMessage).map(copyVisibleMessage),
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
			messages: candidate.messages.filter(isVisibleMessage).map(copyVisibleMessage),
			context: candidate.context.filter(isChatMessage).map(copyMessage),
		};
	} catch {
		return null;
	}
};
