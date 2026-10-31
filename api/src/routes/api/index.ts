import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import rateLimitMiddleware from "../../middleware/rate-limit";
// Las declaraciones de tipo de los decoradores (`pg`, `groq`, `embedding`) viven en
// los plugins. Importarlos aquí —aunque no se registren— es lo que las carga cuando
// se compila archivo a archivo (ts-node), que es como corren los tests.
import "../../plugins/db";
import "../../plugins/embedding";
import "../../plugins/groq";
import "../../plugins/logging";
import "../../plugins/session-budget";
import { createChatOptions } from "../../schemas/chat";
import { type ChatEvent, chatService, generationErrorEvent } from "../../services/chat";
import { chatConfig } from "../../services/chat.config";
import { BUDGET_SESSION_HEADER } from "../../services/sessionBudget";

const chatOptions = createChatOptions(chatConfig.historyLimits.maxMessageChars);

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
export const toSSE = async function* (events: AsyncIterable<ChatEvent>): AsyncIterable<string> {
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

	/**
	 * Empezar una conversación nueva reinicia el presupuesto de la sesión.
	 *
	 * Es la salida del corte: sin ella, quedarse sin presupuesto sería un callejón
	 * sin salida (#148).
	 */
	fastify.post("/chat/session/reset", async (request, reply) => {
		const sessionId = request.headers[BUDGET_SESSION_HEADER];

		if (typeof sessionId === "string" && sessionId.trim().length > 0) {
			fastify.budget.reset(sessionId.trim());
		}

		return reply.code(204).send();
	});

	fastify.post("/chat", chatOptions, async (request, reply) => {
		const { question, history = [] } = request.body as {
			question: string;
			history?: ChatEvent extends { type: "sources"; history: infer H } ? H : never;
		};

		const sessionHeader = request.headers[BUDGET_SESSION_HEADER];
		const sessionId = typeof sessionHeader === "string" ? sessionHeader.trim() : "";

		// Los tres límites cuentan sobre la misma ruta: la ráfaga corta antes, el diario
		// es el respaldo por IP y el tope global el último, que es el único que no se
		// puede eludir rotando la IP (#143).
		const limit = await fastify.checkRateLimits(request, reply);

		if (limit !== "none") {
			return reply.code(429).send({
				error: {
					code: limit === "global" ? "GLOBAL_LIMIT_EXCEEDED" : "RATE_LIMIT_EXCEEDED",
					message:
						limit === "global"
							? "The assistant is busy today. Try again later."
							: limit === "daily"
								? "Daily request limit exceeded, retry in 1 day."
								: "Rate limit exceeded, retry in 1 minute.",
				},
			});
		}

		if (question.trim().length === 0 || question.trim().length > 1000) {
			return reply.code(400).send({
				error: {
					code: "INVALID_QUESTION",
					message: "Question must be between 1 and 1000 characters long.",
				},
			});
		}

		const chat = chatService({
			pg: fastify.pg,
			groqClient: fastify.groq.client,
			modelDefault: fastify.groq.options.modelDefault,
			embedText: fastify.embedding.embedText,
			logger: fastify.logger,
			budget: fastify.budget,
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
						sessionId,
					})
				)
			)
		);
	});
};

export default api;
