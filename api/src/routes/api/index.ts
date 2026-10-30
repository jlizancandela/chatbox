import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import rateLimitMiddleware from "../../middleware/rate-limit";
// Las declaraciones de tipo de los decoradores (`pg`, `groq`, `embedding`) viven en
// los plugins. Importarlos aquí —aunque no se registren— es lo que las carga cuando
// se compila archivo a archivo (ts-node), que es como corren los tests.
import "../../plugins/db";
import "../../plugins/embedding";
import "../../plugins/groq";
import { chatOptions } from "../../schemas/chat";
import {
	chatService,
	generationErrorEvent,
	type ChatEvent,
} from "../../services/chat";

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
			data = { sources: event.sources, history: event.history };
			break;
		case "token":
			data = { token: event.token };
			break;
		case "done":
			data = {};
			break;
		case "error":
			data =
				event.retryAfterSeconds === undefined
					? { code: event.code, message: event.message }
					: {
							code: event.code,
							message: event.message,
							retryAfterSeconds: event.retryAfterSeconds,
						};
			break;
	}

	return `event: ${event.type}\ndata: ${JSON.stringify(data)}\n\n`;
};

/**
 * El stream es total: lo que lance el origen de eventos se convierte en un frame `error` de
 * cierre. Dejar que el fallo suba al manejador de errores significa intentar un cuerpo JSON
 * sobre una respuesta ya empezada, y eso no es una respuesta: es una conexión cortada sin
 * explicación (#144).
 */
export const toSSE = async function* (
	events: AsyncIterable<ChatEvent>,
): AsyncIterable<string> {
	try {
		for await (const event of events) {
			yield encodeEvent(event);
		}
	} catch {
		yield encodeEvent(generationErrorEvent());
	}
};

const api: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	await fastify.register(rateLimitMiddleware);

	fastify.post("/chat", chatOptions, async (request, reply) => {
		const { question, history = [] } = request.body as {
			question: string;
			history?: ChatEvent extends { type: "sources"; history: infer H } ? H : never;
		};

		if (question.trim().length === 0 || question.trim().length > 1000) {
			return reply.code(400).send({
				error: {
					code: "INVALID_QUESTION",
					message:
						"Question must be between 1 and 1000 characters long.",
				},
			});
		}

		const chat = chatService({
			pg: fastify.pg,
			groqClient: fastify.groq.client,
			modelDefault: fastify.groq.options.modelDefault,
			embedText: fastify.embedding.embedText,
		});

		const controller = new AbortController();

		// El cierre se observa en la RESPUESTA, no en la petición. El `close` de un
		// IncomingMessage se dispara en cuanto Node da por leído el body del POST —con el
		// cliente todavía conectado leyendo el stream—, así que vigilarlo aquí abortaba
		// toda generación nada más empezar y el stream moría tras `sources` (#93).
		// `reply.raw` solo se cierra antes de tiempo cuando el cliente se va de verdad, que
		// es el único caso en el que conviene dejar de generar.
		reply.raw.on("close", () => {
			if (!reply.raw.writableEnded) {
				controller.abort();
			}
		});

		reply.headers(SSE_HEADERS);

		return reply.send(
			Readable.from(
				toSSE(
					chat.askStream(question, {
						history,
						signal: controller.signal,
					}),
				),
			),
		);
	});
};

export default api;
