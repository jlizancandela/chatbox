import { createParser, type EventSourceMessage } from "eventsource-parser";
import type {
	ChatMessage,
	ChatSource,
	DoneEvent,
	ErrorEvent,
	SourcesEvent,
	TokenEvent,
} from "../../types";

export type ChatEvent = SourcesEvent | TokenEvent | DoneEvent | ErrorEvent;

export type SSEParser = {
	feed: (chunk: string) => ChatEvent[];
	reset: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isChatMessage = (value: unknown): value is ChatMessage =>
	isRecord(value) &&
	(value.role === "user" || value.role === "assistant") &&
	typeof value.content === "string";

const isChatSource = (value: unknown): value is ChatSource =>
	isRecord(value) &&
	typeof value.documentId === "string" &&
	typeof value.chunkIndex === "number" &&
	typeof value.content === "string" &&
	typeof value.distance === "number";

const parseEvent = (event: EventSourceMessage): ChatEvent | null => {
	let payload: unknown;

	try {
		payload = JSON.parse(event.data) as unknown;
	} catch {
		return null;
	}

	switch (event.event) {
		case "sources":
			if (
				!isRecord(payload) ||
				!Array.isArray(payload.sources) ||
				!payload.sources.every(isChatSource) ||
				!Array.isArray(payload.history) ||
				!payload.history.every(isChatMessage)
			) {
				return null;
			}

			return {
				type: "sources",
				sources: payload.sources,
				history: payload.history,
			};

		case "token":
			if (!isRecord(payload) || typeof payload.token !== "string") {
				return null;
			}

			return { type: "token", token: payload.token } satisfies TokenEvent;

		case "done":
			return { type: "done" } satisfies DoneEvent;

		case "error":
			if (!isRecord(payload) || typeof payload.message !== "string") {
				return null;
			}

			return { type: "error", message: payload.message } satisfies ErrorEvent;

		default:
			return null;
	}
};

export const createSSEParser = (): SSEParser => {
	let events: ChatEvent[] = [];

	const parser = createParser({
		onEvent: (event) => {
			const parsed = parseEvent(event);

			if (parsed) {
				events.push(parsed);
			}
		},
	});

	return {
		feed: (chunk) => {
			events = [];
			parser.feed(chunk);

			return events;
		},
		reset: () => {
			events = [];
			parser.reset();
		},
	};
};

export const parseSSE = (data: string): ChatEvent | null => {
	const parser = createSSEParser();
	return parser.feed(data)[0] ?? null;
};
