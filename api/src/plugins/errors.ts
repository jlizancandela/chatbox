import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const errors: FastifyPluginAsync = async (fastify) => {
	fastify.setErrorHandler<FastifyError>((error, _request, reply) => {
		if (error.validation || error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
			return reply.code(400).send({
				error: {
					code: "VALIDATION_ERROR",
					message: "Request validation failed",
				},
			});
		}

		if (error.statusCode === 404) {
			return reply.code(404).send({
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
				},
			});
		}

		return reply.code(500).send({
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
			},
		});
	});
};

export default fp(errors);
