import type { ChatMessage } from "./types";

export const HISTORY_MAX_MESSAGES = 20;
export const HISTORY_MAX_MESSAGE_CHARS = 2000;
export const HISTORY_MAX_TOTAL_CHARS = 8000;
export const QUESTION_MAX_CHARS = 1000;
export const STORAGE_KEY = "chatbox:v1";

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
	messages: ChatMessage[];
	context: ChatMessage[];
};

export type ConversationStore = {
	getState: () => ConversationState;
	addMessage: (message: ChatMessage) => void;
	setMessages: (messages: ChatMessage[]) => void;
	setContext: (context: ChatMessage[]) => void;
	reset: () => void;
};

export type ChatRequest = {
	question: string;
	history: ChatMessage[];
};

export const createConversationStore = (
	initial: Partial<ConversationState> = {}
): ConversationStore => {
	let messages = [...(initial.messages ?? [])];
	let context = [...(initial.context ?? [])];

	return {
		getState: () => ({ messages: [...messages], context: [...context] }),
		addMessage: (message) => {
			messages = [...messages, message];
		},
		setMessages: (nextMessages) => {
			messages = [...nextMessages];
		},
		setContext: (nextContext) => {
			context = [...nextContext];
		},
		reset: () => {
			messages = [];
			context = [];
		},
	};
};

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
