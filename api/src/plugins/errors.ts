import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * El cuerpo del 404.
 *
 * Lo sirven dos caminos —la ruta que no existe y el handler de errores— y tiene que
 * ser el mismo en los dos: una sola constante impide que se separen (#176).
 */
const notFound = {
	error: { code: "NOT_FOUND", message: "Resource not found" },
};

const errors: FastifyPluginAsync = async (fastify) => {
	/**
	 * Una ruta que no existe no pasa por el handler de errores: Fastify responde con su
	 * forma por defecto —`{"message":"Route GET:/x not found","error":"Not Found",
	 * "statusCode":404}`—, que es otro envelope y además delata el framework. Sin este
	 * registro, el contrato de errores públicos no se cumple (#176).
	 */
	fastify.setNotFoundHandler(async (_request, reply) => reply.code(404).send(notFound));

	fastify.setErrorHandler<FastifyError>((error, request, reply) => {
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

		// Un `Content-Type` que Fastify no sabe leer —multipart, urlencoded— llega con su
		// propio estado 415. Sin esta rama caía en el 500 genérico, y el cliente no podía
		// distinguir "mandé mal la petición" de "el servidor se rompió" (#176).
		if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
			return reply.code(415).send({
				error: {
					code: "UNSUPPORTED_MEDIA_TYPE",
					message: "Unsupported media type",
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
			return reply.code(404).send(notFound);
		}

		// Fastify **no** escribe la línea del error cuando el handler es propio: llama al
		// handler y nada más (`node_modules/fastify/lib/error-handler.js`). Sin este
		// registro, un 500 en producción deja la traza de la petición y ninguna causa
		// (#176). Se registra el error —mensaje y stack—, nunca el cuerpo ni el historial
		// (#146).
		request.log.error({ err: error, requestId: request.id }, "request failed");

		return reply.code(500).send({
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
			},
		});
	});
};

export default fp(errors);
