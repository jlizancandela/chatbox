import { SESSION_HEADER } from "./session";
import type { ChatEvent } from "./sse";
import { createSSEParser } from "./sse";

export type ChatStreamRequest = {
	apiUrl: string;
	body: unknown;
	signal: AbortSignal;
	fetchImpl?: typeof fetch;
	/** El identificador de sesión, para que el servidor pueda contabilizar el consumo (#148). */
	sessionId?: string;
};

export const requestChatStream = async ({
	apiUrl,
	body,
	signal,
	fetchImpl = fetch,
	sessionId,
}: ChatStreamRequest): Promise<Response> =>
	fetchImpl(`${apiUrl}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(sessionId ? { [SESSION_HEADER]: sessionId } : {}),
		},
		body: JSON.stringify(body),
		signal,
	});

export const readChatEvents = async function* (response: Response): AsyncGenerator<ChatEvent> {
	if (!response.body) return;

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const parser = createSSEParser();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;

			for (const event of parser.feed(decoder.decode(value, { stream: true }))) {
				yield event;
			}
		}
	} finally {
		reader.releaseLock();
	}
};
