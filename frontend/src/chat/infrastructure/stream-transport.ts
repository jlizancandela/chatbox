import type { ChatEvent } from "./sse";
import { createSSEParser } from "./sse";

export type ChatStreamRequest = {
	apiUrl: string;
	body: unknown;
	signal: AbortSignal;
	fetchImpl?: typeof fetch;
};

export const requestChatStream = async ({
	apiUrl,
	body,
	signal,
	fetchImpl = fetch,
}: ChatStreamRequest): Promise<Response> =>
	fetchImpl(`${apiUrl}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
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
