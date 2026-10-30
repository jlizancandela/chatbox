import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const errors: FastifyPluginAsync = async (fastify) => {
	fastify.setErrorHandler<FastifyError>((error, _request, reply) => {
		// Una respuesta que ya empezó no admite cuerpo JSON: `send` volvería a escribir
		// cabeceras, lanzaría ERR_HTTP_HEADERS_SENT y se llevaría el proceso por delante. Es
		// exactamente cómo un fallo a mitad de stream se convierte en un corte seco, sin
		// cuerpo ni explicación (#144). Con el cuerpo en marcha, lo único honesto es cerrarlo.
		if (reply.raw.headersSent) {
			if (!reply.raw.writableEnded) {
				reply.raw.end();
			}

			// La respuesta ya no es de Fastify: sin esto quedaría un reply sin enviar que el
			// ciclo de vida seguiría tratando como si tuviera que escribir.
			reply.hijack();

			return reply;
		}

		if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
			return reply.code(413).send({
				error: {
					code: "REQUEST_TOO_LARGE",
					message: "Request body is too large",
				},
			});
		}

		if (error.validation || error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
			return reply.code(400).send({
				error: {
					code: "VALIDATION_ERROR",
					message: "Request validation failed",
				},
			});
		}

		if (error.statusCode === 429) {
			return reply.code(429).send({
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: error.message ?? "Rate limit exceeded",
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
