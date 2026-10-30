import { createParser, type EventSourceMessage } from "eventsource-parser";
import { isChatSource } from "../domain/sources";
import type {
	ChatMessage,
	DoneEvent,
	ErrorEvent,
	SourcesEvent,
	StreamErrorCode,
	TokenEvent,
} from "../types";

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

const isStreamErrorCode = (value: unknown): value is StreamErrorCode =>
	value === "GENERATION_FAILED" || value === "QUOTA_EXHAUSTED";

const isRetryAfterSeconds = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;

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

		case "error": {
			if (!isRecord(payload) || typeof payload.message !== "string") {
				return null;
			}

			// El código es lo único que distingue la cuota; un valor desconocido o ausente
			// (servidor anterior al contrato) cae en el genérico en vez de perder el error.
			const retryAfterSeconds = payload.retryAfterSeconds;

			return {
				type: "error",
				code: isStreamErrorCode(payload.code) ? payload.code : "GENERATION_FAILED",
				message: payload.message,
				...(isRetryAfterSeconds(retryAfterSeconds) ? { retryAfterSeconds } : {}),
			} satisfies ErrorEvent;
		}

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
