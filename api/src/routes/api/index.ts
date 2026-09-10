import type { FastifyPluginAsync } from "fastify";
import { chatOptions } from "../../schemas/chat";
import { chatService } from "../../services/chat";

const api: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
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
		const result = await chat.ask(question);
		return reply.send(result);
	});
};

export default api;
