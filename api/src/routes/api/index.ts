import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import rateLimitMiddleware from "../../middleware/rate-limit";
import { chatOptions } from "../../schemas/chat";
import { chatService, type ChatEvent } from "../../services/chat";

const SSE_HEADERS = {
	"content-type": "text/event-stream",
	"cache-control": "no-cache, no-transform",
	connection: "keep-alive",
	"x-accel-buffering": "no",
};

const encodeEvent = (event: ChatEvent): string => {
	let data: unknown;

	switch (event.type) {
		case "sources":
			data = { sources: event.sources };
			break;
		case "token":
			data = { token: event.token };
			break;
		case "done":
			data = {};
			break;
		case "error":
			data = { message: event.message };
			break;
	}

	return `event: ${event.type}\ndata: ${JSON.stringify(data)}\n\n`;
};

const toSSE = async function* (
	events: AsyncIterable<ChatEvent>,
): AsyncIterable<string> {
	for await (const event of events) {
		yield encodeEvent(event);
	}
};

const api: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	await fastify.register(rateLimitMiddleware);

	fastify.post("/chat", chatOptions, async (request, reply) => {
		const { question } = request.body as { question: string };

		if (question.trim().length === 0 || question.trim().length > 1000) {
			return reply.code(400).send({
				error: {
					code: "INVALID_QUESTION",
					message: "Question must be between 1 and 1000 characters long.",
				},
			});
		}

		const chat = chatService(
			fastify.pg,
			fastify.groq.client,
			fastify.groq.options.modelDefault,
		);

		const controller = new AbortController();

		request.raw.on("close", () => {
			if (!reply.raw.writableEnded) {
				controller.abort();
			}
		});

		reply.headers(SSE_HEADERS);

		return reply.send(
			Readable.from(toSSE(chat.askStream(question, controller.signal))),
		);
	});
};

export default api;