import type { FastifyPluginAsync } from "fastify";

const chatOptions = {
	schema: {
		body: {
			type: "object",
			required: ["question"],
			additionalProperties: false,
			properties: {
				question: {
					type: "string",
					minLength: 1,
				},
			},
		},
	},
};

const api: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
	fastify.post("/chat", chatOptions, async (_request, reply) =>
		reply.code(501).send({
			error: {
				code: "CHAT_NOT_IMPLEMENTED",
				message: "Chat functionality is not available yet.",
			},
		}),
	);
};

export default api;
