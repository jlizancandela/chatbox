import type { ChatMessage, VisibleMessage } from "../types";
import { isChatSource } from "./sources";

export const HISTORY_MAX_MESSAGES = 20;
export const HISTORY_MAX_MESSAGE_CHARS = 2000;
export const HISTORY_MAX_TOTAL_CHARS = 8000;
export const QUESTION_MAX_CHARS = 1000;

export type ChatLimits = {
	maxMessages: number;
	maxMessageChars: number;
	maxTotalChars: number;
};

export const DEFAULT_LIMITS: ChatLimits = {
	maxMessages: HISTORY_MAX_MESSAGES,
	maxMessageChars: HISTORY_MAX_MESSAGE_CHARS,
	maxTotalChars: HISTORY_MAX_TOTAL_CHARS,
};

export type ConversationState = {
	messages: VisibleMessage[];
	context: ChatMessage[];
};

export type ChatRequest = {
	question: string;
	history: ChatMessage[];
};

export const isChatMessage = (value: unknown): value is ChatMessage => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		(candidate.role === "user" || candidate.role === "assistant") &&
		typeof candidate.content === "string"
	);
};

/**
 * Un mensaje visible es un mensaje del API que puede traer las fuentes de la
 * respuesta. Las fuentes son opcionales: los mensajes del usuario no las tienen.
 */
export const isVisibleMessage = (value: unknown): value is VisibleMessage => {
	if (!isChatMessage(value)) {
		return false;
	}

	const sources = (value as VisibleMessage).sources;
	if (sources === undefined) {
		return true;
	}

	return Array.isArray(sources) && sources.every(isChatSource);
};

const copyMessage = (message: ChatMessage): ChatMessage => ({
	role: message.role,
	content: message.content,
});

const totalChars = (messages: readonly ChatMessage[]): number =>
	messages.reduce((total, message) => total + message.content.length, 0);

export const trimHistory = (
	messages: readonly ChatMessage[],
	limits: ChatLimits = DEFAULT_LIMITS
): ChatMessage[] => {
	let trimmed = messages
		.filter(isChatMessage)
		.map((message) => ({
			role: message.role,
			content: message.content.slice(0, limits.maxMessageChars),
		}))
		.slice(-limits.maxMessages);

	while (trimmed.length > 1 && totalChars(trimmed) > limits.maxTotalChars) {
		trimmed = trimmed.slice(1);
	}

	if (trimmed.length === 1 && trimmed[0].content.length > limits.maxTotalChars) {
		trimmed[0] = {
			...trimmed[0],
			content: trimmed[0].content.slice(0, limits.maxTotalChars),
		};
	}

	if (trimmed[0]?.role === "assistant") {
		trimmed = trimmed.slice(1);
	}

	return trimmed.map(copyMessage);
};

export const mergeContext = (sourcesHistory: readonly ChatMessage[]): ChatMessage[] =>
	sourcesHistory.filter(isChatMessage).map(copyMessage);

export const buildChatRequest = (
	text: string,
	context: readonly ChatMessage[],
	limits: ChatLimits = DEFAULT_LIMITS
): ChatRequest => {
	const question = text.trim();

	if (question.length === 0) {
		throw new Error("QUESTION_EMPTY");
	}
	if (question.length > QUESTION_MAX_CHARS) {
		throw new Error("QUESTION_TOO_LONG");
	}

	return {
		question,
		history: trimHistory(context, limits),
	};
};
